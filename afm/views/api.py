#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request, jsonify, render_template
from flask.ext.login import login_required, current_user

import requests
from afm import app, db
from afm.models import UserFavoritesCache
from afm.helpers import safe_input_object, send_mail


@app.route('/api/radio/search')
def radio_search():
    q = request.args.get('q', type=unicode)
    resp = requests.get('http://localhost:9200/afm/radio/_search', params={'q': q + '*'})
    hits = [hit['_source'] for hit in resp.json()['hits'].get('hits', [])]
    return jsonify({'objects': hits, 'q': q})

@app.route('/api/radio/featured')
def radio_featured():
    objects = [radio.get_public() for radio in db.Radio.find_public({'is_public': True}).limit(30)]
    return jsonify({'objects': objects})

@app.route('/api/radio/genre/<int:genre_id>')
def radio_by_genre(genre_id):
    where = {'is_public': True, 'genres': genre_id}
    objects = [radio.get_public() for radio in db.Radio.find(where).limit(30)]
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
    radio = db.Radio.find_one_or_404({'id': radio_id}).get_public()
    if current_user.is_authenticated():
        radio['favorite'] = UserFavoritesCache(user_id=current_user.id).exists('station', radio_id)
    stream = db.Stream.find_one({
        'radio_id': radio_id,
        'content_type': 'audio/mpeg',
        'deleted_at': 0,
    })
    if stream:
        radio['stream'] = stream.get_public()
    return jsonify(radio)


@app.route('/api/station/random')
def station_random():
    station = db.Radio.find_random()
    return jsonify({'station': station.get_public()})


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
