#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, make_response, abort
from datetime import datetime

from afm import app, db


@app.route('/<path:path>')
def page(path):
    page = db.Page.find_one_or_404({'path': path, 'deleted_at': 0})
    if not page:
        abort(404)
    response = make_response(render_template('pages/page.html', page=page))
    last_modified = datetime.fromtimestamp(page.updated_at or page.created_at)
    response.headers['Last-Modified'] = last_modified
    return response
