#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, jsonify, request
from afm import app, db

@app.route('/admin')
def admin():
    return render_template('pages/admin.html')


@app.route('/_admin/genres')
def admin_genres():
    genres = [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})]
    return jsonify({'genres': genres})


@app.route('/_admin/radio/genre/<int:genre_id>')
def admin_radio_by_genre(genre_id):
    where = {'deleted_at': 0, 'genres': genre_id}
    objects = [radio.get_public() for radio in db.Radio.find(where)]
    return jsonify({'objects': objects})

def get_radio(radio_id):
    radio = db.Radio.find_one({'id': radio_id})
    radio = radio.get_public(['id', 'title', 'description', 'is_public', 'updated_at'])
    return radio

@app.route('/_admin/radio/<int:radio_id>')
def admin_radio(radio_id):
    return jsonify({'radio': get_radio(radio_id)})


@app.route('/_admin/radio/<int:radio_id>/save', methods=['POST'])
def admin_radio_save(radio_id):
    radio = db.Radio.find_one({'id': radio_id})
    radio.modify(request.json['radio'])
    return jsonify({'radio': get_radio(radio_id)})
