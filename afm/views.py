#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymongo
import ujson as json
from . import app, db, login_manager, tasks, i18n
from .forms import SignupForm
from flask import jsonify, request, render_template, redirect, url_for
from flask.ext.login import login_user, login_required, current_user, logout_user
from .models import UserFavoritesCache

def send_mail(**kwargs):
    if app.debug:
        # don't send mail in debug env
        return
    return tasks.send_mail.delay(**kwargs)

@app.route('/')
def index():
    return render_template('index.html')

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

@app.route('/token_auth/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        login_user(user)
    return redirect('/')

# HTTP-адрес инбокса по почтовому ящику
def get_email_provider(email):
    domain = email.split('@')[1].lower()
    for link, domains in app.config['EMAIL_PROVIDERS'].items():
        if domain in domains:
            return link
    return None

@app.route('/api/user/amnesia', methods=['POST'])
def api_user_amnesia():
    email = request.form['email']
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        body = render_template('mail/password_reset.html', user=user, password=password, token=token)
        send_mail(subject='Reset password on Again.FM', email=user.email, body=body)
        email_provider = get_email_provider(user.email)
        return jsonify({'email_provider': email_provider})
    return jsonify({'error': 'No such user'})

@app.route('/api/user/signup', methods=['POST'])
def signup():
    form = SignupForm(request.form)
    if not form.validate():
        return jsonify({'error': 'bad request'})
    if db.User.find_one({'email': form.email.data}):
        return jsonify({'error': 'email_exists'})
    # create
    user = db.User()
    user.email = form.email.data
    user.set_password(form.password.data)
    user.save()
    # login
    login_user(user)
    # send welcome email
    body = render_template('mail/welcome.html', user=user)
    send_mail(subject='Welcome to Again.FM', email=user.email, body=body)
    return jsonify(user.get_public_data())

@app.route('/api/user/logout', methods=['DELETE','POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'logout': True})

@app.route('/api/user/change_password', methods=['PUT'])
@login_required
def change_password():
    password = request.form['password'].strip()
    if password:
        current_user.set_password(password)
        current_user.save()
    return jsonify(current_user.get_public_data())

@app.route('/api/user/change_name', methods=['PUT'])
@login_required
def change_name():
    name = request.form['name'].strip()
    current_user.name = name
    current_user.save()
    return jsonify(current_user.get_public_data())

@app.route('/api/user/settings', methods=['GET','POST'])
@login_required
def settings():
    if request.method == 'POST':
        current_user.settings = request.json
        current_user.save()
    return jsonify(current_user.settings)

@app.route('/api/user/login', methods=['POST'])
def login():
    data = request.form
    if '@' in data['login']:
        where = {'email': data['login']}
    else:
        where = {'login': data['login']}
    user = db.User.find_one(where)
    if user:
        direct_auth = user.check_password(data['password'])
        new_password_auth = user.confirm_new_password(data['password'])
        if direct_auth or new_password_auth:
            login_user(user)
            return jsonify(user.get_public_data())
        else:
            return jsonify({'error': 'Please check that you have entered your login and password correctly'})
    else:
        return jsonify({'error': 'No such account'})

@app.route('/api/playlist/tag/<tagname>')
def api_tag_playlist(tagname):
    tag = db.StationTag.find_one_or_404({'tag': tagname})
    stations = [station.get_public_data() for station in db.Station.find({'tag': tag['tag']})]
    #stations = [station.get_public_data() for station in db.Station.find()]
    return jsonify({'objects': stations})

@app.route('/api/playlist/favorite')
@login_required
def api_favorite_playlist():
    favorite_stations = db.FavoriteStation.find({'user_id': current_user.id})
    favorite_stations = dict([(row['station_id'], row['created_at']) for row in favorite_stations])
    # выборка по списку айдишников
    query = {'id': {'$in': favorite_stations.keys()}}
    stations = [station.get_public_data() for station in db.Station.find(query)]
    # сортируем по времени добавления
    stations.sort(reverse=True, key=lambda station: favorite_stations.get(station['id']))
    return jsonify({'objects': stations})


@app.route('/api/station/<int:station_id>')
def api_station_detail(station_id):
    station = db.Station.find_one_or_404({'id': station_id})
    return jsonify(station.get_public_data())

@app.route('/api/station/<int:station_id>/getplayinfo')
def api_station_getplayinfo(station_id):
    """
    Возвращает поток для плеера.
    с параметром low_bitrate выбирается самый меньший битрейт

    @param station_id:
    @return: json
    """
    sort_direction = pymongo.ASCENDING if request.args.get('low_bitrate') else pymongo.DESCENDING
    stream = db.Stream.find_one_or_404({'station_id': station_id, 'is_online': True}, sort=[('bitrate', sort_direction)])
    resp = {
        'stream': {
            'id': stream['id'],
            'url': stream.get_web_url(),
            'bitrate': stream['bitrate'],
        }
    }

    # возвращаем наличие станции в закладках, если пользователь авторизован
    if current_user.is_authenticated():
        favorite_cache = UserFavoritesCache(user_id=current_user.id)
        resp['station'] = {
            'favorite': favorite_cache.exists('station', station_id)
        }

    return jsonify(resp)

@app.route('/api/user/favorite/station/<int:station_id>', methods=['GET', 'POST'])
@login_required
def favorite_station(station_id):
    # проверка на существование станции
    # можно конечно и без нее, но тогда реально засрать
    # избранное несуществующими станциями
    db.Station.find_one_or_404({'id': station_id})
    favorite_cache = UserFavoritesCache(user_id=current_user.id)
    if request.method == 'POST':
        info = db.FavoriteStation.toggle(station_id, user_id=current_user.id)
        state = favorite_cache.toggle('station', station_id, state=info['favorite'])
    else:
        state = favorite_cache.exists('station', station_id)
    return jsonify({'favorite': state})

@app.route('/api/user/favorite/track/<int:track_id>', methods=['GET', 'POST'])
@login_required
def favorite_track(track_id):
    onair_info = db.OnairHistory.find_one_or_404({'track_id': track_id})
    station = db.Station.find_one_or_404({'id': onair_info['station_id']})
    track = db.Track.find_one_or_404({'id': track_id})

    favorite_cache = UserFavoritesCache(user_id=current_user.id)
    if request.method == 'POST':
        info = db.FavoriteTrack.toggle(track, station, current_user.id)
        state = favorite_cache.toggle('track', track_id, state=info['favorite'])
    else:
        state = favorite_cache.exists('track', track_id)
    return jsonify({'favorite': state})

@app.route('/api/user/favorites')
@login_required
def favorites_list():
    query = {'user_id': current_user._id}
    last_id = request.args.get('last_id', 0, type=int)
    if last_id:
        query['id'] = {'$lt': last_id}
    favorite = db.Favorite.find(query).sort('id', pymongo.DESCENDING).limit(1)
    if not favorite:
        return jsonify({})
    return jsonify(favorite.get_public_data())

"""
быстрый фильтр-сериализатор json
"""
@app.template_filter('json')
def template_filter_json(data):
    return json.dumps(data)

@app.context_processor
def app_bootstrap():
    #categories = [tag.get_public_data() for tag in db.StationTag.find({'is_public': True})]
    bootstrap = {
        'user': {},
        'i18n': i18n.get_json_dict(),
        #'settings': {},
        #'categories': categories,
        #'playlist': {}
    }
    if current_user.is_authenticated():
        bootstrap['user'] = current_user.get_public_data()
        #bootstrap['settings'] = current_user.settings

    #bootstrap['playlist'] = [station.get_public_data() for station in db.Station.find()]
    return dict(bootstrap=bootstrap)

@app.context_processor
def app_config():
    static_url = url_for('.static', filename='')
    context = {
        'sitename': 'Again.FM',
        'static_url': static_url,
    }
    return context

@app.route('/station/<int:station_id>')
def station_details(station_id):
    station = db.Station.find_one({'id': station_id})
    if not station:
        redirect('/')

    return render_template('index.html', station=station.get_public_data())

@app.template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

@app.context_processor
def i18n_context():
    return {
        '_': i18n_template_filter,
        'sitelang': 'en',
    }
