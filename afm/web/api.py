#!/usr/bin/env python
# -*- coding: utf-8 -*-

from afm import app, db
from flask import request, jsonify, render_template, url_for, Response, session, redirect
from flask.ext.login import login_user, login_required, current_user, logout_user
from afm.models import UserFavoritesCache
from .helpers import safe_input_field, safe_input_object, send_mail, get_email_provider


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


@app.route('/api/radio/featured')
def radio_featured():
    objects = [radio.get_public() for radio in db.Radio.find().limit(30)]
    return jsonify({'objects': objects})

@app.route('/api/radio/genre/<int:genre_id>')
def radio_by_genre(genre_id):
    objects = [radio.get_public() for radio in db.Radio.find({'genres': genre_id}).limit(30)]
    return jsonify({'objects': objects})

@app.route('/api/user/tracks')
@login_required
def user_tracks():
    tracks = db.FavoriteTrack.find({'user_id': current_user.id, 'favorite': {'$not': {'$mod': [2, 0]}}})
    tracks = [track.get_public() for track in tracks]
    return jsonify({'objects': tracks})

@app.route('/api/user/tracks/<int:track_id>/add', methods=['POST'])
@app.route('/api/user/tracks/<int:track_id>/remove', methods=['POST'])
@app.route('/api/user/tracks/<int:track_id>/restore', methods=['POST'])
@login_required
def user_tracks_add_or_remove(track_id):
    onair_info = db.OnairHistory.find_one_or_404({'track_id': track_id})
    station = db.Station.find_one_or_404({'id': onair_info['station_id']})
    track = db.Track.find_one_or_404({'id': track_id})

    favorite_cache = UserFavoritesCache(user_id=current_user.id)
    info = db.FavoriteTrack.toggle(track, station, current_user.id)
    state = favorite_cache.toggle('track', track_id, state=info['favorite'])
    return jsonify({'favorite': state})


@app.route('/api/user/favorites')
@login_required
def user_favorites():
    favorite_stations = db.FavoriteStation.find({'user_id': current_user.id})
    favorite_stations = dict([(row['station_id'], row['created_at']) for row in favorite_stations])
    # выборка по списку айдишников
    query = {'id': {'$in': favorite_stations.keys()}}
    stations = [station.get_public() for station in db.Station.find(query)]
    # сортируем по времени добавления
    stations.sort(key=lambda station: favorite_stations.get(station['id']), reverse=True)
    return jsonify({'objects': stations})

@app.route('/api/user/favorites/<int:station_id>/add', methods=['POST'])
@app.route('/api/user/favorites/<int:station_id>/remove', methods=['POST'])
@login_required
def user_favorites_add_or_remove(station_id):
    # проверка на существование станции
    # можно конечно и без нее, но тогда реально засрать
    # избранное несуществующими станциями
    db.Station.find_one_or_404({'id': station_id})
    favorite_cache = UserFavoritesCache(user_id=current_user.id)
    info = db.FavoriteStation.toggle(station_id, user_id=current_user.id)
    state = favorite_cache.toggle('station', station_id, state=info['favorite'])
    # удаляем станцию из списка
    if not state:
        db.FavoriteStation.remove(station_id, user_id=current_user.id)
    return jsonify({'favorite': state})


@app.route('/api/radio/<int:radio_id>')
def api_radio(radio_id):
    response = db.Radio.find_one_or_404({'id': radio_id}).get_public()
    if current_user.is_authenticated():
        response['favorite'] = UserFavoritesCache(user_id=current_user.id).exists('station', radio_id)
    return jsonify(response)


@app.route('/api/station/random')
def station_random():
    station = db.Radio.find_random()
    return jsonify({'station': station.get_public()})


@app.route('/auth/token/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        permanent_login_user(user)
    return redirect('/')

@app.route('/api/feedback', methods=['POST'])
def feedback():
    form = safe_input_object({
        'text': {'type': 'string', 'maxLength': 2048},
        'email': {'type': 'string', 'maxLength': 255}
    })

    # TODO: fix this shit
    form['text'] = unicode(form['text'])
    form['email'] = unicode(form['email'])

    message = db.FeedbackMessage()
    message.update(form)
    message.remote_addr = unicode(request.remote_addr)
    message.save()

    body = render_template('mail/feedback.html', **message)
    send_mail(email=app.config['ADMIN_EMAIL'], body=body, subject=u'Обратная связь')

    return jsonify({'success': True})
