#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, redirect
from datetime import datetime

from flask.ext.login import current_user
from afm import db, app, redis
from afm.helpers import get_ts

# TODO:
# починить pushState историю при работе с модалами
# ~ ui-router
# отключение от комет сервера при паузе
# в историю попадают только играющие радиостанции
# чекер радиостанций
# страница радиостанции
#
# дисплей: показывать кол-во слушателей
# проигрывание истории эфира
# cross-line animate при загрузке радио
# фильтр рекламы в истории эфира


@app.route('/')
def index():
    return render_template('player.html')


@app.route('/signup')
@app.route('/amnesia')
@app.route('/login')
def user_actions():
    if current_user.is_authenticated():
        return redirect('/')
    return render_template('player.html')


@app.route('/listen/<int:radio_id>')
def listen(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    return render_template('player.html', radio=radio)


@app.route('/about')
def about():
    return render_template('pages/about.html')


@app.route('/jobs')
def jobs():
    return render_template('pages/jobs.html')


@app.route('/radio/<int:radio_id>')
def radio(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    history = db.Air.find({'radio_id': radio_id}).sort('ts', -1).limit(10)
    current_air = redis.hgetall('radio:{}:onair'.format(radio_id))
    return render_template('radio.html', radio=radio, history=history, current_air=current_air)


@app.route('/partial/radio/<int:radio_id>/air')
def partial_radio_air(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    history = db.Air.find({'radio_id': radio_id}).sort('ts', -1).limit(100)
    current_air = redis.hgetall('radio:{}:onair'.format(radio_id))
    return render_template('radio_air.html', radio=radio, history=history, current_air=current_air)


@app.route('/partial/radio/<int:radio_id>/share')
def partial_radio_share(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    return render_template('radio_share.html', radio=radio)


@app.route('/feedback')
def feedback():
    return render_template('user/feedback.html')


def app_stats():
    radio_count = db.radio.find({'deleted_at': 0}).count()
    return {
        'radio': radio_count
    }


@app.context_processor
def app_context():
    return {
        'standalone': request.is_xhr,
        'genres': [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})],
        'year': datetime.now().year,
        'stats': app_stats(),
        'production': False,
    }