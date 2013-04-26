#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request
from datetime import datetime

from afm import db, app


@app.route('/')
@app.route('/signup')
@app.route('/amnesia')
@app.route('/login')
def index():
    return render_template('player.html')


@app.route('/radio/<int:radio_id>')
def listen(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    return render_template('player.html', radio=radio)


@app.route('/radio/<int:radio_id>/<slug>')
def radio_details(radio_id, slug=None):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    if request.args.get('partial'):
        return render_template('radio_details.html', radio_details=radio)
    return render_template('player.html', radio_details=radio)


@app.route('/partial/radio/<int:radio_id>')
def partial_radio_details(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    return render_template('radio_details.html', radio_details=radio)


@app.context_processor
def app_context():
    return {
        'standalone': request.is_xhr,
        'genres': [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})],
        'year': datetime.now().year,
    }