#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
import ujson as json
from flask import g, request, jsonify
from jinja2 import escape

from afm import app


@app.before_request
def save_start_time():
    g.start = time.time()


@app.after_request
def x_headers(response):
    response.headers['X-Request-Time'] = int(round((time.time() - g.start) * 1000))
    return response


@app.errorhandler(404)
def page_not_found(e):
    if request.is_xhr:
        return jsonify({'error': 'Not Found'}), 404
    return '<h1>Not Found</h1>', 404


@app.template_filter('json')
def template_filter_json(data):
    return escape(json.dumps(data))


from . import views, user, player, admin