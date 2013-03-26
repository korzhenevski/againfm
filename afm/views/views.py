#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
from flask import jsonify, render_template, g, request
from flask.ext.login import current_user
from datetime import datetime

from afm import db, app

@app.route('/radio/')
def radio():
    radio_list = db.Radio.find({'deleted_at': 0})
    return render_template('radio.html', radio_list=radio_list)

@app.route('/radio/<int:radio_id>')
def radio_page(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    return render_template('radio_page.html', radio=radio)

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

@app.route('/')
def index():
    return render_template('player.html')

@app.route('/listen/<int:radio_id>')
def listen(radio_id):
    return render_template('player.html')



@app.context_processor
def app_context():
    ctx = {'user': None}
    if current_user.is_authenticated():
        ctx['user'] = current_user.get_public()
    ctx['genres'] = [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})]
    ctx['year'] = datetime.now().year
    return ctx

