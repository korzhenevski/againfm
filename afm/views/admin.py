#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, jsonify, request
from afm import app, db


@app.route('/admin')
def admin():
    return render_template('pages/admin.html')

@app.route('/_admin/genres')
def _admin_genres():
    genres = db.RadioGenre.find()
    genres = [genre.get_public() for genre in genres]
    return jsonify({'genres': genres})

@app.route('/_admin/radio/genre/<int:genre_id>')
def _admin_radio_by_genre(genre_id):
    where = {'deleted_at': 0, 'genres': genre_id}
    objects = [radio.get_public() for radio in db.Radio.find(where)]
    return jsonify({'objects': objects})


@app.route('/_admin/radio/<int:radio_id>')
def _admin_radio(radio_id):
    radio = db.Radio.find_one({'id': radio_id})
    return jsonify({'radio': radio.get_public()})

@app.route('/_admin/radio/<int:radio_id>/save', methods=['POST'])
def _admin_radio_save(radio_id):
    db.radio.update({'id': radio_id}, {'$set': request.json['radio']})
    return jsonify({'status': True})
