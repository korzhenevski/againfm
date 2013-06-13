#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request, jsonify, abort, render_template
import requests

from afm import app, db, redis
from afm.helpers import raw_redirect, get_ts, get_onair

"""
TODO:
    добавление радио
"""


@app.route('/_radio/search')
def player_radio_search():
    q = request.args.get('q', type=unicode)
    try:
        resp = requests.get('http://localhost:9200/afm/radio/_search', params={'q': u'title:{}*'.format(q)}).json()
    except (RuntimeError, ValueError):
        return jsonify({'objects': [], 'error': True})

    hits = [hit['_source'] for hit in resp.get('hits', {}).get('hits', [])]
    return jsonify({'objects': hits})


@app.route('/_radio/featured')
def player_radio_featured():
    objects = [radio.get_public() for radio in db.Radio.find_public({'is_public': True}).limit(30)]
    return jsonify({'objects': objects})


@app.route('/_radio/genre/<int:genre_id>')
def player_radio_by_genre(genre_id):
    where = {'is_public': True, 'deleted_at': 0, 'genre': genre_id}
    objects = [radio.get_public() for radio in db.Radio.find(where).limit(30)]
    return jsonify({'objects': objects})


def select_stream(radio_id):
    where = {
        'radio_id': radio_id,
        'is_online': True,
        'deleted_at': 0,
        'check.error_at': {'$lte': get_ts() - 12 * 3600}
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

    streams = list(db.Stream.find(where, sort=[('bitrate', -1)]))
    if not streams:
        return

    stream = streams[0]
    return {
        'id': stream.id,
        'url': stream.listen_url,
        'bitrate': stream.bitrate
    }


@app.route('/_radio/<int:radio_id>')
def player_radio(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id}).get_public()
    #if current_user.is_authenticated():
    #    radio['favorite'] = UserFavoritesCache(user_id=current_user.id).exists('station', radio_id)
    radio['stream'] = select_stream(radio_id)
    return jsonify(radio)


@app.route('/_radio/<int:radio_id>/onair_history')
def player_radio_onair(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    history = list(db.Air.find({'radio_id': radio_id}).sort('ts', -1).limit(20))
    return render_template('radio_onair.html', radio=radio, history=history, current_onair=get_onair(radio_id))


@app.route('/_radio/<int:radio_id>/stream')
def player_radio_stream(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    stream = select_stream(radio_id)
    if not stream:
        abort(404)
    stream['radio'] = radio.get_public('id,title')
    if request.args.get('redir'):
        return raw_redirect(stream['url'])
    return jsonify(stream)


@app.route('/_radio/random')
def player_radio_random():
    radio_id = redis.srandmember('radio:public')
    if not radio_id:
        abort(404)

    radio = db.Radio.find_one_or_404({'id': int(radio_id), 'deleted_at': 0})
    return jsonify(radio.get_public())


@app.route('/_event/radio', methods=['POST'])
def player_event_radio():
    return jsonify({'ok': 1})