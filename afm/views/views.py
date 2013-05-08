#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, redirect
from flask.ext.login import current_user
from datetime import datetime
from afm import db, app, redis

# TODO:
#
# дисплей: показывать кол-во слушателей
# проигрывание истории эфира
# cross-line animate при загрузке радио
# фильтр рекламы в истории эфира


@app.route('/')
@app.route('/feedback')
def index():
    return render_template('player.html')

@app.route('/signup')
@app.route('/amnesia')
@app.route('/login')
def user_actions():
    if current_user.is_authenticated():
        return redirect('/')
    return render_template('player.html')

@app.route('/radio/<int:radio_id>')
def listen(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    return render_template('player.html', radio=radio)

"""
@app.route('/radio/<int:radio_id>/<slug>')
def radio_details(radio_id, slug=None):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    if request.args.get('partial'):
        return render_template('radio_details.html', radio_details=radio)
    return render_template('player.html', radio_details=radio)
"""

@app.route('/partial/radio/<int:radio_id>/air')
def partial_radio_air(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    history = db.Air.find({'radio_id': radio_id}).sort('ts', -1).limit(100)
    current_air = redis.hgetall('radio:{}:onair'.format(radio_id))
    #history = [{'title': u'Madonna - Artist' * 20, 'natural_day': u'Сегодня', 'time': datetime.now()}]
    return render_template('radio_air.html', radio=radio, history=history, current_air=current_air)

@app.route('/partial/radio/<int:radio_id>/share')
def partial_radio_share(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    return render_template('radio_share.html', radio=radio)


@app.context_processor
def app_context():
    return {
        'standalone': request.is_xhr,
        'genres': [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})],
        'year': datetime.now().year,
    }