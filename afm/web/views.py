#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time 
import ujson as json
from afm import db, login_manager, i18n, app
from . import web
from flask import jsonify, render_template, g, request, url_for, redirect
from flask.ext.login import current_user
from datetime import datetime

if app.debug:
    @web.route('/guideline')
    def guideline():
        return render_template('guideline.html')

@app.route('/favicon.ico')
def favicon():
    return redirect(url_for('static', filename='i/favicon.ico'))

@web.before_request
def save_start_time():
    g.start = time.time()

@web.after_request
def x_headers(response):
    response.headers['X-Request-Time'] = round(time.time() - g.start, 4)
    return response

@login_manager.user_loader
def load_user(user_id):
    return db.User.find_one({'id': user_id})

@web.route('/radio/')
def radio():
    radio_list = db.Radio.find({'deleted_at': 0})
    return render_template('radio.html', radio_list=radio_list)

@web.route('/radio/<int:radio_id>')
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

@web.route('/')
@web.route('/login')
@web.route('/signup')
@web.route('/amnesia')
@web.route('/feedback')
def index():
    return render_template('player.html')

@web.route('/listen/<int:radio_id>')
def listen(radio_id):
    return render_template('player.html')

# TODO: add error pages templates
@login_manager.unauthorized_handler
def unauthorized():
    if request.is_xhr:
        return jsonify({'error': 'Auth required'}), 401
    return redirect(url_for('login'))

@app.errorhandler(404)
def page_not_found(e):
    if request.is_xhr:
        return jsonify({'error': 'Not Found'}), 404
    return '<h1>Not Found</h1>', 404

# быстрый фильтр-сериализатор json
@web.app_template_filter('json')
def template_filter_json(data):
    return json.dumps(data)

@web.app_template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

@web.context_processor
def app_context():
    ctx = {'user': None}
    if current_user.is_authenticated():
        ctx['user'] = current_user.get_public()
    ctx['genres'] = [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})]
    ctx['year'] = datetime.now().year
    return ctx

