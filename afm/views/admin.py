#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, jsonify, request
from afm import app, db
from afm.models import list_public, create_obj, soft_delete
from afm.views.user import admin_required


def get_radio(radio_id):
    return db.Radio.find_one({'id': radio_id}).as_dict()


def get_genres():
    return list_public(db.RadioGenre.find_public().sort('id', -1), fields=['id', 'title', 'is_public'])


@app.route('/admin')
@admin_required
def admin():
    return render_template('admin/admin.html')


@app.route('/admin/genres')
@admin_required
def genres_admin():
    return render_template('admin/genres.html')


@app.route('/_admin/genres')
@admin_required
def admin_genres():
    return jsonify({'genres': get_genres()})


@app.route('/_admin/genres/save', methods=['POST'])
@admin_required
def admin_genres_save():
    genres = request.json['genres']

    for genre in genres:
        if 'id' in genre:
            db.radio_genre.update({'id': genre['id']}, {'$set': genre})
        else:
            genre['title'] = unicode(genre['title'])
            create_obj(db.RadioGenre, genre)

    return jsonify({'genres': get_genres()})


@app.route('/_admin/genres/nav')
@admin_required
def admin_genres_nav():
    genres = list_public(db.RadioGenre.find_public())
    genres.append({'id': 0, 'title': u'Все Радиостанции'})
    return jsonify({'genres': genres})


@app.route('/_admin/radio/genre/<int:genre_id>')
@admin_required
def admin_radio_by_genre(genre_id):
    where = {'deleted_at': 0}
    if genre_id:
        where['genre'] = genre_id
    objects = list_public(db.Radio.find(where).sort('created_at', -1), fields=['id', 'title', 'is_public'])
    return jsonify({'objects': objects})


@app.route('/_admin/radio/<int:radio_id>')
@admin_required
def admin_radio(radio_id):
    return jsonify({
        'radio': get_radio(radio_id),
        'streams': list_public(db.Stream.find_public({'radio_id': radio_id}))
    })


@app.route('/_admin/radio/<int:radio_id>/save', methods=['POST'])
@admin_required
def admin_radio_save(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id})
    radio.modify(request.json['radio'])
    return jsonify({'radio': get_radio(radio_id)})


@app.route('/_admin/radio/<int:radio_id>/delete', methods=['POST'])
@admin_required
def admin_radio_delete(radio_id):
    soft_delete('radio', radio_id)
    return jsonify({'status': 'ok'})

