#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request, jsonify, render_template, abort
from flask.ext.login import login_required, current_user

import random
import requests
from afm import app, db, redis
from afm.models import UserFavoritesCache
from afm.helpers import safe_input_object, send_mail, raw_redirect


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
    resp = requests.get('http://localhost:9200/afm/radio/_search', params={'q': u'title:{}*'.format(q)})
    hits = [hit['_source'] for hit in resp.json()['hits'].get('hits', [])]
    return jsonify({'objects': hits, 'q': q})


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


@app.route('/api/radio/<int:radio_id>/listen')
def api_radio_listen(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id}).get_public(['id', 'title'])
    if current_user.is_authenticated():
        radio['favorite'] = UserFavoritesCache(user_id=current_user.id).exists('station', radio_id)

    streams = list(db.Stream.find({'radio_id': radio_id, 'is_online': True, 'deleted_at': 0}))
    if not streams:
        return abort(404)

    stream = random.choice(streams)
    radio['listen_url'] = stream.listen_url
    radio['stream_id'] = stream.id
    radio['bitrate'] = stream.bitrate

    if request.args.get('redir'):
        return raw_redirect(stream.listen_url)

    return jsonify(radio)


@app.route('/api/radio/<int:radio_id>')
def api_radio(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id}).get_public()
    if current_user.is_authenticated():
        radio['favorite'] = UserFavoritesCache(user_id=current_user.id).exists('station', radio_id)
    return jsonify(radio)


@app.route('/api/radio/random')
def api_radio_random():
    radio_id = redis.srandmember('radio:public')
    if not radio_id:
        abort(404)

    radio = db.Radio.find_one_or_404({'id': int(radio_id), 'deleted_at': 0})
    return jsonify(radio.get_public())


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

    body = render_template('mail/feedback.html', **message)
    send_mail(email=app.config['ADMIN_EMAIL'], body=body, subject=u'Обратная связь')

    return jsonify({'success': True})
