#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request, jsonify, abort
import requests

from flask.ext.login import login_required, current_user
from afm import app, db, redis
from afm.models import UserFavoritesCache
from afm.helpers import raw_redirect, get_ts


"""
TODO:
    директива modal, обертка для модальных окон любого размера
    добавление радио
    страница эфира - история
    ngmin + grunt для боевого js
    после логина/регистрации страница перезагружается
"""


@app.route('/api/radio/search')
def api_radio_search():
    q = request.args.get('q', type=unicode)
    try:
        resp = requests.get('http://localhost:9200/afm/radio/_search', params={'q': u'title:{}*'.format(q)}).json()
    except (RuntimeError, ValueError):
        return jsonify({'objects': [], 'error': True})

    hits = [hit['_source'] for hit in resp.get('hits', {}).get('hits', [])]
    return jsonify({'objects': hits})


@app.route('/api/radio/featured')
def api_radio_featured():
    objects = [radio.get_public() for radio in db.Radio.find_public({'is_public': True}).limit(30)]
    return jsonify({'objects': objects})


@app.route('/api/radio/genre/<int:genre_id>')
def api_radio_by_genre(genre_id):
    where = {'is_public': True, 'deleted_at': 0, 'genres': genre_id}
    objects = [radio.get_public() for radio in db.Radio.find(where).limit(30)]
    return jsonify({'objects': objects})


@app.route('/api/user/favorites')
@login_required
def api_user_favorites():
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
def api_user_favorites_add_or_remove(station_id):
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


def select_stream(radio_id):
    where = {
        'radio_id': radio_id,
        'is_online': True,
        'deleted_at': 0,
        'check.error_at': {'$lte': get_ts() - 12*3600}
    }

    """
    player_params = request.args.get('p')
    if player_params is None:
        player_params = 'mp3'

    player_params = set(player_params.split(','))
    formats = []
    if 'ogg' in player_params:
        formats.append('audio/ogg')
    if 'mp3' in player_params:
        formats.append('audio/mpeg')

    if not formats:
        abort(404)
    where['content_type'] = {'$in': formats}
    """

    streams = list(db.Stream.find(where, sort=[('bitrate', 1)]))
    if not streams:
        return

    stream = streams[0]
    return {
        'id': stream.id,
        'url': stream.listen_url,
        'bitrate': stream.bitrate
    }


@app.route('/api/radio/<int:radio_id>')
def api_radio(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id}).get_public()
    if current_user.is_authenticated():
        radio['favorite'] = UserFavoritesCache(user_id=current_user.id).exists('station', radio_id)
    radio['stream'] = select_stream(radio_id)
    return jsonify(radio)


@app.route('/api/radio/<int:radio_id>/stream')
def api_radio_listen(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    stream = select_stream(radio_id)
    if not stream:
        abort(404)
    stream['radio'] = radio.get_public('id,title')
    if request.args.get('redir'):
        return raw_redirect(stream['url'])
    return jsonify(stream)


@app.route('/api/radio/random')
def api_radio_random():
    radio_id = redis.srandmember('radio:public')
    if not radio_id:
        abort(404)

    radio = db.Radio.find_one_or_404({'id': int(radio_id), 'deleted_at': 0})
    return jsonify(radio.get_public())
