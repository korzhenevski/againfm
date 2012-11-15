#!/usr/bin/env python
# -*- coding: utf-8 -*-

import requests
import logging
import ujson as json
from afm import db, login_manager, i18n, app
from . import web
from .connect.vkontakte import VKApi
from flask import jsonify, render_template, redirect, url_for, request, current_app
from flask.ext.login import login_user, current_user
from urllib import urlencode

@login_manager.user_loader
def load_user(user_id):
    return db.User.find_one({'id': user_id})

@web.route('/')
def index():
    return render_template('index.html')

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

@web.route('/auth/token/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        login_user(user, remember=True)
    return redirect('/')

def vk_connect(user, code):
    config = current_app.config['VK']
    response = requests.get(config['access_token_url'], params={
        'client_id': config['app_id'],
        'client_secret': config['secret'],
        'code': code,
        'redirect_uri': url_for('web.vk_connect_request', _external=True)})

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

@web.route('/connect/vk')
def vk_connect_request():
    vk = current_app.config['VK']
    code = request.args.get('code')
    if code:
        user = current_user if current_user.is_authenticated() else None
        try:
            user = vk_connect(user, code)
            login_user(user, remember=True)
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
            'redirect_uri': url_for('web.vk_connect_request', _external=True),
            'response_type': 'code'
        })
        return redirect(authorize_url)

# быстрый фильтр-сериализатор json
@web.app_template_filter('json')
def template_filter_json(data):
    return json.dumps(data)

@web.app_template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

@web.context_processor
def app_context():
    bootstrap = {
        'user': {},
        'i18n': i18n.get_json_dict(),
        'display': {
            'genres': db.Genre.public_list(lang=app.config['LANG']),
        }
    }
    if current_user.is_authenticated():
        bootstrap['user'] = current_user.get_public()

    return {
        'sitename': 'Again.FM',
        'bootstrap': bootstrap,
        '_': i18n_template_filter,
    }

@web.route('/radio/<int:station_id>')
def station_details(station_id):
    station = db.Station.find_one({'id': station_id})
    if not station:
        redirect('/')

    return render_template('index.html', radio=station.get_public())

@web.route('/403')
def forbidden():
    return render_template('403.html')

@web.route('/404')
def not_found():
    return render_template('404.html')

@web.route('/500')
def server_error():
    return render_template('500.html')
