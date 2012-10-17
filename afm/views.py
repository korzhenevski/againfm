#!/usr/bin/env python
# -*- coding: utf-8 -*-

import ujson as json
from . import app, db, login_manager, i18n
from flask import jsonify, render_template, redirect, url_for, request
from flask.ext.login import login_user, current_user

@app.route('/')
def index():
    return render_template('index.html')

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

@app.route('/auth/token/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        login_user(user)
    return redirect('/')

@app.route('/auth/vk')
def vk_auth():
    from urllib import urlencode
    import requests
    vk = app.config['VK']
    code = request.args.get('code')
    if code:
        resp = requests.get(vk['access_token_url'], params={
            'client_id': vk['app_id'],
            'client_secret': vk['secret'],
            'code': code,
            'redirect_uri': url_for('vk_auth', _external=True),
        })
        access_token = resp.json
        return jsonify(access_token)
    else:
        authorize_url = vk['authorize_url'] + '?'
        authorize_url += urlencode({
            'client_id': vk['app_id'],
            'scope': 'settings,offline',
            'redirect_uri': url_for('vk_auth', _external=True),
            'response_type': 'code'
        })
        return redirect(authorize_url)

# быстрый фильтр-сериализатор json
@app.template_filter('json')
def template_filter_json(data):
    return json.dumps(data)

@app.template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

@app.context_processor
def app_context():
    #categories = [tag.get_public_data() for tag in db.StationTag.find({'is_public': True})]
    static_url = url_for('.static', filename='')
    bootstrap = {
        'user': {},
        'i18n': i18n.get_json_dict(),
    }
    if current_user.is_authenticated():
        bootstrap['user'] = current_user.get_public_data()

    return {
        'sitename': 'Again.FM',
        'bootstrap': bootstrap,
        'static_url': static_url,
        '_': i18n_template_filter,
    }

@app.route('/station/<int:station_id>')
def station_details(station_id):
    station = db.Station.find_one({'id': station_id})
    if not station:
        redirect('/')

    return render_template('index.html', station=station.get_public_data())

@app.route('/user/favorites')
@app.route('/user/settings')
def user_routes():
    if not current_user.is_authenticated():
        redirect('/')
    return render_template('index.html')
