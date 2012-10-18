#!/usr/bin/env python
# -*- coding: utf-8 -*-

import requests
import logging
import ujson as json
from . import app, db, login_manager, i18n
from .connect.vkontakte import VKApi
from flask import jsonify, render_template, redirect, url_for, request
from flask.ext.login import login_user, current_user
from urllib import urlencode

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

def vk_connect(user, code):
    config = app.config['VK']
    response = requests.get(config['access_token_url'], params={
        'client_id': config['app_id'],
        'client_secret': config['secret'],
        'code': code,
        'redirect_uri': url_for('vk_connect_request', _external=True)})

    if not response.ok:
        raise Exception('VKontakte access token {}'.format(response.status_code))
    result = response.json
    if not result:
        raise Exception('VKontakte empty JSON response')

    api = VKApi(access_token=result['access_token'])
    profile = api.request('getProfiles', params={
        'uid': result['user_id'],
        'fields': 'uid,first_name,last_name,nickname,sex,birthdate,city,country,timezone,photo_50'
    })[0]

    if not user:
        user = db.User.find_one({'connect.vk.uid': result['user_id']})

    if not user:
        user = db.User()

    user.connect['vk'] = profile
    user.connect['vk']['access_token'] = result['access_token']

    if not user.name:
        user.name = ' '.join([profile.get('first_name'), profile.get('last_name')])

    # копируем логин, если он не занят
    nickname = profile.get('nickname')
    if nickname and not user.login and not db.User.find_one({'login': nickname}):
        user.login = nickname
    # пол
    sex = profile['sex']
    if not user.sex:
        if sex == 1:
            user.sex = u'female'
        elif sex == 2:
            user.sex = u'male'
    # аватарка
    photo = profile.get('photo_50')
    if photo and not user.avatar_url and not photo.endswith('camera_c.gif'):
        user.avatar_url = photo

    user.save()
    return user

@app.route('/connect/vk')
def vk_connect_request():
    vk = app.config['VK']
    code = request.args.get('code')
    if code:
        user = current_user if current_user.is_authenticated() else None
        try:
            user = vk_connect(user, code)
            login_user(user)
            return redirect('/')
        except Exception as exc:
            logging.exception(exc)
            return render_template('connect.html')
    else:
        scope = 'friends,audio,offline'
        authorize_url = vk['authorize_url'] + '?'
        authorize_url += urlencode({
            'scope': scope,
            'client_id': vk['app_id'],
            'redirect_uri': url_for('vk_connect_request', _external=True),
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
