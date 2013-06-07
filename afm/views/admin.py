#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, jsonify, request
from afm import app, db


@app.route('/admin')
def admin():
    return render_template('admin/admin.html')

@app.route('/admin/genres')
def genres_admin():
    return render_template('admin/genres.html')


@app.route('/_admin/genres')
def admin_genres():
    genres = [genre.get_public(['id', 'title', 'is_public']) for genre in db.RadioGenre.find({'is_public': True})]
    return jsonify({'genres': genres})


@app.route('/_admin/genres/save', methods=['POST'])
def admin_genres_save():
    genres = request.json['genres']

    for genre in genres:
        if 'id' in genre:
            db.radio_genre.update({'id': genre['id']}, {'$set': genre})
        else:
            new_genre = db.RadioGenre()
            new_genre.update(genre)
            new_genre.save()

    genres = [genre.get_public(['id', 'title', 'is_public']) for genre in db.RadioGenre.find({'is_public': True})]
    return jsonify({'genres': genres})


@app.route('/_admin/genres/nav')
def admin_genres_nav():
    genres = [genre.get_public() for genre in db.RadioGenre.find({'is_public': True})]
    genres.append({'id': 0, 'title': u'Все Радиостанции'})
    return jsonify({'genres': genres})


@app.route('/_admin/radio/genre/<int:genre_id>')
def admin_radio_by_genre(genre_id):
    where = {'deleted_at': 0}
    if genre_id:
        where['genre'] = genre_id
    objects = [radio.get_public('id,title,is_public') for radio in db.Radio.find(where).sort('created_at', -1)]
    return jsonify({'objects': objects})


def get_radio(radio_id):
    radio = db.Radio.find_one({'id': radio_id})
    radio = radio.get_public(['id', 'title', 'description', 'is_public', 'updated_at', 'city', 'genre', 'website'])
    return radio


@app.route('/_admin/radio/<int:radio_id>')
def admin_radio(radio_id):
    return jsonify({'radio': get_radio(radio_id)})


@app.route('/_admin/radio/<int:radio_id>/save', methods=['POST'])
def admin_radio_save(radio_id):
    radio = db.Radio.find_one({'id': radio_id})
    radio.modify(request.json['radio'])
    return jsonify({'radio': get_radio(radio_id)})
