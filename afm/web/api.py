#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymongo
from itsdangerous import URLSafeSerializer
from afm import app, db
from flask import jsonify, request, render_template, url_for
from flask.ext.login import login_user, login_required, current_user, logout_user
from afm.models import UserFavoritesCache
from .helpers import *

# bootstrap this on template
@app.route('/api/user', methods=['POST'])
def user():
    user = None
    if current_user.is_authenticated():
        user = current_user.get_public()
    return jsonify({'user': user})

@app.route('/api/user/login', methods=['POST'])
def login():
    data = safe_input_object({'login': 'string', 'password': 'string'})
    user = db.User.find_login(data['login'])
    if user:
        direct_auth = user.check_password(data['password'])
        new_password_auth = user.confirm_new_password(data['password'])
        if direct_auth or new_password_auth:
            login_user(user, remember=True)
            return jsonify({'user': user.get_public()})
        else:
            return jsonify({'error': 'auth'})
    return jsonify({'error': 'no_user'})

@app.route('/api/user/amnesia', methods=['POST'])
def amnesia():
    email = safe_input_field('email', 'string')
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        auth_url = url_for('web.token_auth', user_id=user.id, token=token, _external=True)
        body = render_template('mail/amnesia.html', auth_url=auth_url, password=password)
        send_mail(email=user.email, body=body)
        return jsonify({'email_provider': get_email_provider(user.email)})
    return jsonify({'error': 'no_user'})

@app.route('/api/user/signup', methods=['POST'])
def signup():
    data = safe_input_object({'email': 'string', 'password': 'string'})
    if db.User.find_one({'email': data['email']}):
        return jsonify({'error': 'email_exists'})
        # create
    user = db.User()
    user.email = unicode(data['email'])
    user.set_password(data['password'])
    user.save()
    # login
    login_user(user, remember=True)
    # send welcome email
    #body = render_template('mail/signup.html')
    #send_mail(email=user.email, body=body)
    return jsonify({'user': user.get_public()})

@app.route('/api/user/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'logout': True})

@app.route('/api/playlist/featured')
def featured_playlist():
    stations = [station.get_public() for station in db.Station.find_public(only_online=True).limit(50)]
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

@app.route('/api/station/random')
def station_random():
    station = db.Station.find_random()
    return jsonify({'station': station.get_public()})

