# -*- coding: utf-8 -*-

import pymongo
import requests
import json
from . import app, db, login_manager, tasks, i18n, redis
from .forms import RegisterForm
from flask import jsonify, request, render_template, redirect, abort, url_for
from flask.ext.login import login_user, login_required, current_user, logout_user
from .models import UserFavorites

def send_mail(**kwargs):
    if app.debug:
        # don't send mail in debug env
        return
    return tasks.send_mail.delay(**kwargs)

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

@app.route('/token_auth/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        login_user(user)
    return redirect('/')

def get_email_provider(email):
    domain = email.split('@')[1].lower()
    for link, domains in app.config['EMAIL_PROVIDERS'].items():
        if domain in domains:
            return link
    return None

@app.route('/api/user/password_reset', methods=['POST'])
def password_reset():
    email = request.form['email']
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        body = render_template('mail/password_reset.html', user=user, password=password, token=token)
        send_mail(subject='Reset password on Again.FM', email=user.email, body=body)
        email_provider = get_email_provider(user.email)
        return jsonify({'email_provider': email_provider, 'status': True})
    return jsonify({'error': {'email': 'No such user'}})

@app.route('/api/user/register', methods=['POST'])
def register():
    form = RegisterForm(request.form)
    if not form.validate():
        return jsonify({'error': form.errors}), 400
    if db.User.find_one({'email': form.email.data}):
        return jsonify({'error': {'email': ['email is already in use']}}), 400
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
            return jsonify({'error': 'Please check that you have entered your login and password correctly'}), 401
    else:
        return jsonify({'error': 'No such account'}), 401

@app.route('/api/playlist/tag/<tagname>')
def tag_playlist(tagname):
    tag = db.StationTag.find_one({'tag': tagname})
    if not tag:
        abort(404)
    stations = [station.get_public_data() for station in db.Station.find({'tag': tag['tag']})]
    #stations = [station.get_public_data() for station in db.Station.find()]
    return jsonify({'objects': stations})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/station/<int:station_id>')
def station_detail(station_id):
    station = db.Station.get_or_404(station_id)
    station = station.get_public_data()
    return jsonify(station.get_public_data())

# http://againfm.local/api/listen/5013ea731d41c80efe0cc300
@app.route('/api/stream_for_station/<int:station_id>')
def stream_for_station(station_id):
    if request.args.get('low_bitrate'):
        sort_direction = pymongo.ASCENDING
    else:
        sort_direction = pymongo.DESCENDING
    stream = db.Stream.find_one({'station_id': station_id, 'is_online': True}, sort=[('bitrate', sort_direction)])
    if not stream:
        abort(404)
    data = stream.get_public_data()
    return jsonify(data)

@app.route('/api/station/<int:station_id>/getplayinfo')
def getplayinfo(station_id):
    """
    Возвращает поток для плеера.
    с параметром low_bitrate выбирается самый меньший битрейт

    @param station_id:
    @return: json
    """
    sort_direction = pymongo.ASCENDING if request.args.get('low_bitrate') else pymongo.DESCENDING
    stream = db.Stream.find_one({'station_id': station_id, 'is_online': True}, sort=[('bitrate', sort_direction)])
    if not stream:
        abort(404)

    resp = {
        'url': stream.get_web_url(),
        'bitrate': stream['bitrate'],
    }

    # возвращаем наличие станции в закладках, если пользователь авторизован
    if current_user.is_authenticated():
        favs = UserFavorites(user_id=current_user.id, redis=redis)
        resp['favorite_station'] = favs.exists('station', station_id)

    return jsonify(resp)

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

@app.route('/api/user/favorites/<int:track_id>/toggle', methods=['POST'])
def add_favorite(track_id):
    pass

@app.context_processor
def app_bootstrap():
    categories = [tag.get_public_data() for tag in db.StationTag.find({'is_public': True})]
    bootstrap = {
        'user': {},
        'settings': {},
        'categories': categories,
        'playlist': {}
    }
    if current_user.is_authenticated():
        bootstrap['user'] = current_user.get_public_data()
        bootstrap['settings'] = current_user.settings

    bootstrap['playlist'] = [station.get_public_data() for station in db.Station.find()]
    return dict(app_bootstrap=bootstrap)

@app.context_processor
def app_config():
    static_url = url_for('.static', filename='')
    context = {
        'sitename': 'Again.FM',
        'app_config': {
            'spectrum': False,
            'default_volume': 80,
            'night_volume': 30,
            'comet_server': app.config['COMET_SERVER'],
            'static_url': static_url,
            'full_static_url': url_for('.static', filename='', _external=True),
        },
        'static_url': static_url,
    }
    return context

@app.route('/station/<int:station_id>')
def station_details(station_id):
    station = db.Station.find_one({'id': station_id})
    if not station:
        redirect('/')

    return render_template('index.html', station=station.get_public_data())

@app.route('/api/search')
def search():
    term = request.args.get('term', '')
    if not term:
        abort(400)
    term = term.strip().strip('*:')[0:64]

    resp = requests.get(app.config['SEARCH_BACKEND_URL'], params={'q': '%s*' % term}, )
    if not (resp.ok and resp.json):
        abort(503)

    hits = resp.json.get('hits', {}).get('hits', [])

    results = []
    for res in hits:
        station = res['_source']
        results.append({
            'id': station['id'],
            'label': station['title'],
            'tag': station.get('tag', ''),
        })

    results = results[0:3]

    return jsonify({'results': results})

@app.template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

@app.context_processor
def i18n_context():
    return {
        '_': i18n_template_filter,
        'sitelang': 'en',
    }

@app.route('/test')
def player_test():
    return render_template('player.html')