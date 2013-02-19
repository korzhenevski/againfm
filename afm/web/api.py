#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymongo
from itsdangerous import URLSafeSerializer
from afm import app, db
from flask import request, jsonify, render_template, url_for, Response, session, redirect
from flask.ext.login import login_user, login_required, current_user, logout_user
from afm.models import UserFavoritesCache
from .helpers import safe_input_field, safe_input_object, send_mail, get_email_provider


class TuneinResponse(Response):
    default_status = 302
    autocorrect_location_header = False


def permanent_login_user(user):
    login_user(user, remember=True)
    session.permanent = True


@app.route('/api/user/login', methods=['POST'])
def login():
    data = safe_input_object({'login': 'string', 'password': 'string'})
    data['login'] = data['login'].lower()
    user = db.User.find_login(data['login'])
    if user:
        direct_auth = user.check_password(data['password'])
        new_password_auth = user.confirm_new_password(data['password'])
        if direct_auth or new_password_auth:
            permanent_login_user(user)
            return jsonify({'user': user.get_public()})
        else:
            return jsonify({'error': 'auth'}), 401
    return jsonify({'error': 'no_user'}), 404


@app.route('/api/user/amnesia', methods=['POST'])
def amnesia():
    email = safe_input_field('email', 'string')
    email = email.lower()
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        auth_url = url_for('token_auth', user_id=user.id, token=token, _external=True)
        body = render_template('mail/amnesia.html', auth_url=auth_url, password=password)
        send_mail(email=user.email, body=body)
        return jsonify({'email_provider': get_email_provider(user.email)})
    return jsonify({'error': 'no_user'}), 404


@app.route('/api/user/signup', methods=['POST'])
def signup():
    data = safe_input_object({'email': 'string', 'password': 'string'})
    data['email'] = data['email'].lower()
    if db.User.find_one({'email': data['email']}):
        return jsonify({'error': 'email_exists'}), 409
    # create
    user = db.User()
    user.email = unicode(data['email'])
    user.set_password(data['password'])
    user.save()
    # login
    permanent_login_user(user)
    # send welcome email
    body = render_template('mail/signup.html')
    send_mail(email=user.email, body=body)
    return jsonify({'user': user.get_public()})


@app.route('/api/user/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'logout': True})


@app.route('/api/playlist/featured')
def featured_playlist():
    stations = [station.get_public() for station in db.Station.find_public(only_online=True).limit(35)]
    return jsonify({'objects': stations})


@app.route('/api/playlist/genre/<genre>')
def genre_playlist(genre):
    genre = db.Genre.find_one_or_404({'id': genre})
    where = {'tags': {'$in': genre['tags']}}
    stations = [station.get_public() for station in db.Station.find_public(where, only_online=True)]
    return jsonify({'objects': stations})


@app.route('/api/user/tracks')
@login_required
def favorites():
    tracks = db.FavoriteTrack.find({'user_id': current_user.id})
    tracks = [track.get_public() for track in tracks]
    return jsonify({'objects': tracks})


@app.route('/api/user/favorites')
@login_required
def user_favorites():
    favorite_stations = db.FavoriteStation.find({'user_id': current_user.id})
    favorite_stations = dict([(row['station_id'], row['created_at']) for row in favorite_stations])
    # выборка по списку айдишников
    query = {'id': {'$in': favorite_stations.keys()}}
    stations = [station.get_public() for station in db.Station.find(query)]
    # сортируем по времени добавления
    stations.sort(key=lambda station: favorite_stations.get(station['id']))
    return jsonify({'objects': stations})


@app.route('/api/station/<int:station_id>')
def station(station_id):
    response = {}
    response['station'] = db.Station.find_one_or_404({'id': station_id}).get_public()

    # TODO: restore 'is_online': True
    stream = db.Stream.find_one_or_404({'station_id': station_id}, sort=[('bitrate', pymongo.DESCENDING)])
    safe_serializer = URLSafeSerializer(secret_key=app.config['SECRET_KEY'])
    safe_channel = safe_serializer.dumps([station_id, stream['id'], request.remote_addr])

    response['station']['stream'] = {
        'url': stream.get_web_url(),
        'bitrate': stream['bitrate'],
        'channel': safe_channel,
    }

    if current_user.is_authenticated():
        favorite_cache = UserFavoritesCache(user_id=current_user.id)
        response['station']['favorite'] = favorite_cache.exists('station', station_id)

    return jsonify(response)


@app.route('/api/station/random')
def station_random():
    station = db.Station.find_random()
    return jsonify({'station': station.get_public()})


@app.route('/api/station/<int:station_id>/tunein')
def station_tunein(station_id):
    stream = db.Stream.find_one_or_404({'station_id': station_id}, fields={'_id': 0}, sort=[('bitrate', -1)])
    response = TuneinResponse()
    response.headers['Location'] = stream.get_web_url().encode('utf8')
    return response


@app.route('/auth/token/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        permanent_login_user(user)
    return redirect('/')