#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, jsonify, url_for, redirect
from flask.ext.login import current_user, login_required
from datetime import datetime

from afm import db, app
from afm.helpers import safe_input_object

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
#
# по жанрам
# /radio/genres

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
@login_required
def radio_edit(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    # проверка прав редактирования
    if not (radio['owner_id'] == current_user['id'] or current_user.is_admin()):
        return redirect(url_for('radio_page', radio_id=radio_id))
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
            db.radio_genre.update({'id': genre['id']}, {'$set': {'title': genre['title'], 'is_public': genre['is_public']}})

    genres = [genre.get_public('id,title,is_public') for genre in db.RadioGenre.find()]
    return jsonify({'genres': genres})

@app.route('/radio/admin/')
@login_required
def radio_admin():
    radio_list = db.Radio.find({'owner_id': current_user['id'], 'deleted_at': 0}).sort([('created_at', -1)])
    return render_template('radio_admin.html', radio_list=radio_list)

@app.route('/radio/add', methods=['POST', 'GET'])
@login_required
def radio_add():
    if request.method == 'POST':
        form = safe_input_object({
            'title': {'type': 'string', 'maxLength': 64},
            'description': {'type': 'string', 'maxLength': 1024},
            'source_url': {'type': 'string', 'maxLength': 1024},
            'website': {'type': 'string'},
        })

        radio = db.Radio()
        radio.update(form)
        radio['owner_id'] = current_user['id']
        radio.save()

        return jsonify({
            'radio': radio.get_public(),
            'location': url_for('radio_admin')
        })

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

