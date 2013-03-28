#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, jsonify, url_for
from flask.ext.login import current_user
from datetime import datetime

from afm import db, app

# ссылка на радио
# /radio/<int>
# юзер может ссылатся на эту страницу. в каталоге выделять отдельно верифицированне, наши и юзерские станции

# ссылка на жанр (фильтр)
# жанров не настолько много, что-бы делать резолв на каждый запрос
# можно тупо перечислить шортнеймы в коде
# /radio/<string>
#
# позже будем регистрировать кастомные имена
# http://again.fm/<shortname>
#
# список радиостанций
# /radio/
#
# пользовательское радио
# /radio/my/
#
# добавление радио
# /radio/add

@app.route('/radio/')
def radio():
    # TODO: add pagination
    radio_list = db.Radio.find({'deleted_at': 0})
    return render_template('radio.html', radio_list=radio_list)

@app.route('/radio/<int:radio_id>')
def radio_page(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    return render_template('radio_page.html', radio=radio)

@app.route('/radio/<int:radio_id>/edit')
def radio_action(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    return render_template('radio_edit.html', radio=radio)

@app.route('/radio/admin/')
def radio_admin():
    return render_template('radio_admin.html')

@app.route('/radio/add', methods=['POST','GET'])
def radio_add():
    if request.method == 'POST':
        import pymongo.errors
        data = request.json
        radio = db.Radio()
        radio['title'] = unicode(data['title'])
        radio['website'] = unicode(data.get('website', u''))
        radio['location'] = unicode(data.get('location', u''))
        radio['owner_id'] = current_user.id
        radio.save()

        for playlist_url in data.get('playlistUrl', []):
            playlist = db.Playlist()
            playlist['url'] = unicode(playlist_url)
            playlist['radio_id'] = radio['id']
            try:
                playlist.save()
            except pymongo.errors.DuplicateKeyError:
                pass

        for stream_url in data.get('streamUrl', []):
            stream = db.Stream()
            stream.update({
                'url': unicode(stream_url),
                'playlist_id': 0,
                'radio_id': radio['id'],
            })

            try:
                stream.save()
            except pymongo.errors.DuplicateKeyError:
                # игнорируем, если поток уде был добавлен из другого плейлиста
                pass

        return jsonify({'radio': radio.get_public(), 'location': url_for('radio_page', radio_id=radio['id'])})

    return render_template('radio_add.html')

@app.route('/')
def index():
    return render_template('player.html')

@app.route('/listen/<int:radio_id>')
def listen(radio_id):
    # TODO: add radio preload by id
    return render_template('player.html')

@app.context_processor
def app_context():
    ctx = {'user': None}
    if current_user.is_authenticated():
        ctx['user'] = current_user.get_public()
    ctx['genres'] = [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})]
    ctx['year'] = datetime.now().year
    # подгрузка страниц аяксом - возвращаем контент без лейаута
    ctx['standalone'] = request.is_xhr
    return ctx

