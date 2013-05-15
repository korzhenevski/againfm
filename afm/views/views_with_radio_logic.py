#!/usr/bin/env python
# -*- coding: utf-8 -*-

import requests
from flask import render_template, request, jsonify, url_for, redirect
from datetime import datetime

from flask.ext.login import current_user, login_required
from afm import db, app
from afm.helpers import safe_input_object


@app.route('/radio/')
def radio():
    # TODO: add pagination
    radio_list = db.Radio.find({'deleted_at': 0})
    return render_template('radio.html', radio_list=radio_list)


@app.route('/radio/<int:radio_id>')
def radio_page(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    return render_template('radio_page.html', radio=radio)


@app.route('/radio/<int:radio_id>/edit', methods=['GET', 'POST'])
@login_required
def radio_edit(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    # проверка права редактирования
    if not (radio['owner_id'] == current_user['id'] or current_user.is_admin()):
        return redirect(url_for('radio_page', radio_id=radio_id))
    if request.method == 'POST':
        data = safe_input_object(db.Radio.get_json_schema())
        print data
        radio.update(data)
        radio.save()
        return jsonify({'ok': True})
    return render_template('radio_edit.html', radio=radio)


@app.route('/radio/genres/')
def radio_genres():
    genres = db.RadioGenre.find({'is_public': True})
    return render_template('radio_genres.html', genres=genres)


@app.route('/radio/genres/edit')
@login_required
def radio_genres_edit():
    return render_template('radio_genres_edit.html')


@app.route('/api/radio/genres/edit', methods=['POST', 'GET'])
@login_required
def api_radio_genres_edit():
    if not current_user.is_admin():
        return url_for('radio')

    if request.method == 'POST':
        for genre in request.json['genres']:
            db.radio_genre.update({'id': genre['id']},
                                  {'$set': {'title': genre['title'], 'is_public': genre['is_public']}})

    genres = [genre.get_public('id,title,is_public') for genre in db.RadioGenre.find()]
    return jsonify({'genres': genres})


@app.route('/radio/admin/')
@login_required
def radio_admin():
    radio_list = db.Radio.find_public({'owner_id': current_user['id']}).sort([('created_at', -1)])
    return render_template('radio_admin.html', radio_list=radio_list)


def radio_add_check():
    from afm.radio import parse_playlist, fetch_stream

    result = dict(playlistUrl='', streams=[])
    playlist = None

    f = request.files.get('file')
    url = request.form.get('url', '').strip()
    text = request.form.get('text', '').strip()

    if f:
        playlist = f.stream.read()
    elif url:
        result['playlistUrl'] = url
        try:
            response = requests.get(url, timeout=2)
            playlist = response.text
        except:
            # TODO: add error handling
            pass
    elif text:
        playlist = text

    streams = parse_playlist(playlist)
    result['streams'] = [dict(url=stream, id=stream_id, use=True) for stream_id, stream in enumerate(streams, start=1)]

    if streams:
        meta = fetch_stream(streams[0], timeout=2, as_player=True).meta
        result.update({
            'title': meta.get('name', ''),
            'website': meta.get('url', ''),
            'description': meta.get('description', '')
        })

    return result


@app.route('/radio/add', methods=['POST', 'GET'])
@login_required
def radio_add():
    if request.method == 'POST' and request.form.get('action') == 'check':
        result = radio_add_check()
        if not result['streams']:
            return render_template('radio_add_check.html', error='no_streams')
        return render_template('radio_add.html', check_result=result)

    return render_template('radio_add_check.html')


@app.route('/radio/add/save', methods=['POST'])
@login_required
def radio_add_save():
    from afm.radio import normalize_url

    schema = {
        'playlistUrl': {
            'type': 'string',
            'blank': True,
            'required': False
        },
        'streams': {
            'type': 'array',
            'items': {'type': 'string'},
            'minLength': 1
        },
    }
    schema.update(db.Radio.get_json_schema())

    form = safe_input_object(schema)

    streams = form.pop('streams', [])
    streams = filter(None, map(normalize_url, streams))

    playlist_url = normalize_url(form.pop('playlistUrl', ''))

    radio = db.Radio()
    radio.update(form)
    radio['owner_id'] = current_user.id
    radio.save()

    playlist_id = 0
    if playlist_url:
        playlist = db.Playlist()
        playlist['url'] = playlist_url
        playlist['radio_id'] = radio.id
        playlist['streams'] = streams
        playlist.save()
        playlist_id = playlist['id']

    db.Stream.bulk_add(radio['id'], streams, playlist_id=playlist_id)
    return jsonify({'location': url_for('radio_admin')})


@app.route('/')
@app.route('/signup')
@app.route('/amnesia')
@app.route('/login')
def index():
    return render_template('player.html')


@app.route('/listen/<int:radio_id>')
def listen(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    return render_template('player.html', radio=radio)


@app.context_processor
def app_context():
    return {
        'standalone': request.is_xhr,
        'genres': [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})],
        'year': datetime.now().year,
    }

