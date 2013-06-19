#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
import ujson as json
from flask import g, request, jsonify, render_template
from jinja2 import escape
from datetime import datetime
from afm import app


@app.before_request
def save_start_time():
    g.start = time.time()


@app.after_request
def x_headers(response):
    response.headers['X-Runtime'] = round(time.time() - g.start, 4)
    return response


@app.errorhandler(404)
def page_not_found(e):
    if request.is_xhr:
        return jsonify({'error': 'Not Found'}), 404
    return render_template('errors/404.html'), 404


@app.template_filter('json')
def template_filter_json(data):
    return escape(json.dumps(data))


@app.template_filter('ts')
def format_timestamp_time(ts, fmt=None):
    if fmt is None:
        fmt = '%Y-%m-%d %H:%M'
    return datetime.fromtimestamp(ts).strftime(fmt)


from . import views, user, player, admin, blog