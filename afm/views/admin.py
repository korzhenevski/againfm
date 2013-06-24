#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, jsonify, request, redirect, url_for
from afm import app, db, redis
from afm.models import list_public, create_obj, soft_delete
from afm.views.user import admin_required
from afm.search import SearchIndex

def get_radio(radio_id):
    fields = {key: True for key in ['id', 'title', 'website', 'description', 'genre', 'is_public', 'updated_at']}
    fields['_id'] = False
    return db.radio.find_one({'id': radio_id}, fields=fields)


def get_genres():
    return list_public(db.RadioGenre.find_public().sort('id', -1), fields=['id', 'title', 'is_public'])


@app.route('/admin/pages')
@admin_required
def admin_pages():
    pages = db.Page.find_public().sort('created_at', -1)
    return render_template('admin/pages.html', pages=pages)


@app.route('/admin/pages/new', methods=['GET', 'POST'])
@admin_required
def admin_pages_new():
    if request.method == 'POST':
        page = create_obj(db.Page, request.form.to_dict())
        return redirect(url_for('admin_pages_edit', page_id=page.id))

    return render_template('admin/pages_edit.html', page=db.Page(), action=url_for('admin_pages_new'))


@app.route('/admin/pages/<int:page_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_pages_edit(page_id):
    page = db.Page.find_one_or_404({'id': page_id, 'deleted_at': 0})

    if request.method == 'POST':
        db.pages.update({'id': page_id}, {'$set': request.form.to_dict()})
        return redirect(url_for('admin_pages_edit', page_id=page.id))

    return render_template('admin/pages_edit.html', page=page, action=url_for('admin_pages_edit', page_id=page.id))


@app.route('/admin/pages/<int:page_id>/remove')
@admin_required
def admin_pages_remove(page_id):
    soft_delete('pages', page_id)
    return redirect(url_for('admin_pages'))


@app.route('/admin/radio')
@admin_required
def admin_radio():
    return render_template('admin/radio.html')


@app.route('/admin/genres')
@admin_required
def admin_genres():
    return render_template('admin/genres.html')


@app.route('/admin')
@admin_required
def admin_index():
    return render_template('admin/index.html')


@app.route('/_admin/stats')
@admin_required
def admin_stats():
    stats = {
        'nowListen': redis.zcard('radio:now_listen'),
        'userCount': db.users.count(),
        'radioCount': db.Radio.find_public().count(),
        'streamCount': db.Stream.find_public().count(),
        'airCount': db.air.count(),
    }
    return jsonify(stats=stats)


@app.route('/_admin/genres')
@admin_required
def admin_genres_data():
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
def admin_radio_data(radio_id):
    return jsonify({
        'radio': get_radio(radio_id),
        'streams': list_public(db.Stream.find_public({'radio_id': radio_id}))
    })


@app.route('/_admin/radio/<int:radio_id>/save', methods=['POST'])
@admin_required
def admin_radio_save(radio_id):
    update = request.json['radio']
    radio = db.Radio.find_one_or_404({'id': radio_id})
    radio.modify(update)
    radio = get_radio(radio_id)
    ix = SearchIndex(app.config['RADIO_INDEX'])
    ix.update({k: v for k, v in radio.iteritems() if k in ['id', 'title']})
    return jsonify({'radio': radio})


@app.route('/_admin/radio/<int:radio_id>/delete', methods=['POST'])
@admin_required
def admin_radio_delete(radio_id):
    soft_delete('radio', radio_id)
    return jsonify({'status': 'ok'})

