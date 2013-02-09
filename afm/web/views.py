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
@web.route('/login')
@web.route('/signup')
@web.route('/amnesia')
def index():
    return render_template('index.html')

@web.route('/guideline')
def guideline():
    return render_template('guideline.html')

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

@web.route('/auth/token/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        login_user(user, remember=True)
    return redirect('/')

# быстрый фильтр-сериализатор json
@web.app_template_filter('json')
def template_filter_json(data):
    return json.dumps(data)

@web.app_template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

