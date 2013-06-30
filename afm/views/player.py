#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request, jsonify, abort, render_template
from afm import app, db, redis
from afm.helpers import raw_redirect, get_ts, get_onair, safe_input_object
from afm.search import SearchIndex

# play_redirect?codecs=mp3,ogg&radio_id=1488&listener_id=<hash>&format=low|high
# playtime?radio_id=1488&state=paused|playing|

@app.route('/_radio/search')
def player_radio_search():
    ix = SearchIndex(app.config['RADIO_INDEX'])
    objects = ix.search(request.args.get('q', type=unicode))
    return jsonify({'objects': objects})


@app.route('/_radio/featured')
def player_radio_featured():
    where = {
        'is_public': True,
        'stream_type': 'audio/mpeg',
    }
    objects = [radio.get_public() for radio in
               db.Radio.find_public(where).sort([('air.listeners', -1), ('id', -1)]).limit(30)]
    return jsonify({'objects': objects})


@app.route('/_radio/genre/<int:genre_id>')
def player_radio_by_genre(genre_id):
    where = {
        'is_public': True,
        'stream_type': 'audio/mpeg',
        'genre': genre_id
    }
    objects = [radio.get_public() for radio in db.Radio.find_public(where).limit(30)]
    return jsonify({'objects': objects})


def select_stream(radio_id):
    where = {
        'radio_id': radio_id,
        'is_online': True,
        'deleted_at': 0,
        'content_type': 'audio/mpeg',
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
    onair = get_onair(radio_id)
    history = list(db.Air.find({
        'id': {'$ne': onair.get('id', -1)},
        'radio_id': radio_id
    }).sort('ts', -1).limit(250))
    return render_template('radio_onair.html', radio=radio, history=history, current_onair=onair)


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


@app.route('/_event/player', methods=['POST'])
def player_event():
    event = safe_input_object({
        'act': {'type': 'string', 'enum': ['play', 'stop', 'random', 'previous', 'listen_error']},
        'rid': {'type': 'integer', 'required': False, 'dependencies': 'act'},
        'sid': {'type': 'integer', 'required': False, 'dependencies': 'act'},
        'dur': {'type': 'integer', 'required': False, 'dependencies': 'act'},
        'uid': {'type': 'integer', 'required': False, 'dependencies': 'act'},
    })

    event['ua'] = request.user_agent.string
    event['ip'] = request.remote_addr
    event['ts'] = get_ts()

    db.player_events.insert(event)
    return jsonify({'ok': 1})