#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, redirect, make_response, abort
from datetime import datetime

from flask.ext.login import current_user
from afm import db, app
from afm.helpers import get_onair, build_playlist, benchmark


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


@app.route('/badbrowser')
def badbrowser():
    return render_template('pages/badbrowser.html')


@app.route('/radio/<int:radio_id>')
def radio(radio_id):
    with benchmark('radio page'):
        data = {
            'radio': db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0}),
            'history': list(db.Air.find({'radio_id': radio_id}).sort('ts', -1).limit(10)),
            'current_air': get_onair(radio_id),
            'prev_radio': db.radio.find_one({'id': {'$lt': radio_id}}, fields=['id', 'title'], sort=[('id', -1)]),
            'next_radio': db.radio.find_one({'id': {'$gt': radio_id}}, fields=['id', 'title'], sort=[('id', 1)]),
        }

    return render_template('radio.html', **data)


@app.route('/radio/<int:radio_id>.pls')
def download_playlist(radio_id):
    streams = list(db.Stream.find({'radio_id': radio_id, 'deleted_at': 0}, fields=['url']))
    if not streams:
        abort(404)
    response = make_response(build_playlist(stream['url'] for stream in streams))
    response.content_type = 'audio/x-scpls'
    return response


@app.route('/feedback')
def feedback():
    return render_template('user/feedback.html')


@app.route('/siberia')
def siberia():
    return render_template('siberia.html')


def app_stats():
    radio_count = db.radio.find({'deleted_at': 0}).count()
    return {
        'radio': radio_count
    }


@app.context_processor
def app_context():
    genres = [genre.get_public() for genre in db.RadioGenre.find({'is_public': True}).sort('id', -1)]
    return {
        'standalone': request.is_xhr,
        'genres': genres,
        'year': datetime.now().year,
        'stats': app_stats(),
        'production': False,
    }