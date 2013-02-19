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
@web.route('/radio/<station_id>')
def index(station_id=None):
    return render_template('index.html')

@web.route('/guideline')
def guideline():
    return render_template('guideline.html')

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

# быстрый фильтр-сериализатор json
@web.app_template_filter('json')
def template_filter_json(data):
    return json.dumps(data)

@web.app_template_filter('i18n')
def i18n_template_filter(key):
    return i18n.translate(key)

@web.context_processor
def app_context():
    bootstrap = {'user': None}
    if current_user.is_authenticated():
        bootstrap['user'] = current_user.get_public()
    return bootstrap