#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymongo
from . import app, db
from flask import jsonify, request, render_template
from flask.ext.login import login_user, login_required, current_user, logout_user
from .models import UserFavoritesCache
from .helpers import *

@app.route('/api/user/login', methods=['POST'])
def login():
    data = safe_input_object({'login': 'string', 'password': 'string'})
    if '@' in data['login']:
        # логин по почте
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
            return jsonify({'error': 'auth'})
    return jsonify({'error': 'no_user'})

@app.route('/api/user/amnesia', methods=['POST'])
def api_user_amnesia():
    email = safe_input_field('email', 'string')
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        body = render_template('mail/password_reset.html', user=user, password=password, token=token)
        send_mail(subject='Reset password on Again.FM', email=user.email, body=body)
        email_provider = get_email_provider(user.email)
        return jsonify({'email_provider': email_provider})
    return jsonify({'error': 'no_user'})

@app.route('/api/user/signup', methods=['POST'])
def api_user_signup():
    data = safe_input_object({'email': 'string', 'password': 'string'})
    if db.User.find_one({'email': data['email']}):
        return jsonify({'error': 'email_exists'})
        # create
    user = db.User()
    user.email = data['email']
    user.set_password(data['password'])
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
    return jsonify({'success': True})

@app.route('/api/user/password', methods=['POST'])
@login_required
def change_password():
    data = safe_input_object({
        'current_password': {'type': 'string'},
        'password': {'type': 'string', 'minLength': 6}
    })
    if not current_user.check_password(data['current_password']):
        return jsonify({'error': 'incorrect_password'}), 401
    current_user.set_password(data['password'])
    current_user.save()
    login_user(current_user)
    return jsonify({'success': True})

@app.route('/api/user/name', methods=['POST'])
@login_required
def api_user_name():
    name = safe_input_field('name', {'type': 'string', 'maxLength': 64})
    current_user.name = name
    current_user.save()
    login_user(current_user)
    return jsonify({'name': current_user.name})

@app.route('/api/user/settings', methods=['GET','POST'])
@login_required
def api_user_settings():
    # схема валидации на основе структуры модели
    schema = dict([(k, 'boolean') for k in db.User.structure['settings'].keys()])
    settings = safe_input_object(schema)
    if request.method == 'POST':
        current_user.update_settings(settings)
        # reload user via relogin
        login_user(current_user)
    return jsonify(current_user.settings)

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
        # удаляем станцию из списка
        if not state:
            db.FavoriteStation.remove(station_id, user_id=current_user.id)
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
def api_user_favorites():
    favorites = db.FavoriteTrack.find({'user_id': current_user.id})
    favorites = [favorite.get_public_data() for favorite in favorites]
    return jsonify({'objects': favorites})

@app.route('/api/feedback', methods=['POST'])
def api_feedback():
    form = safe_input_object({
        'text': {'type': 'string', 'maxLength': 2048},
        'email': {'type': 'string', 'maxLength': 255}
    })
    message = db.FeedbackMessage()
    message.update(form)
    message.remote_addr = unicode(request.remote_addr)
    message.save()
    return jsonify({'success': True})

