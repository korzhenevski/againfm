#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
import ujson as json
from flask import g, request, jsonify
from afm import app
from jinja2 import Markup

@app.before_request
def save_start_time():
    g.start = time.time()

@app.after_request
def x_headers(response):
    response.headers['X-Request-Time'] = round(time.time() - g.start, 4)
    return response

@app.errorhandler(404)
def page_not_found(e):
    if request.is_xhr:
        return jsonify({'error': 'Not Found'}), 404
    return '<h1>Not Found</h1>', 404

# быстрый фильтр-сериализатор json
@app.template_filter('json')
def template_filter_json(data):
    return Markup(json.dumps(data))

from . import views, user, api