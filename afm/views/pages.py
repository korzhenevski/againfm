#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, redirect, url_for, make_response, abort
from datetime import datetime

from afm import app, db
from afm.models import create_obj
from afm.views.user import admin_required


@app.route('/pages')
def pages():
    pages = db.Page.find_public().sort('created_at', -1)
    return render_template('pages/pages.html', pages=pages)


@app.route('/pages/admin', methods=['GET', 'POST'])
@admin_required
def pages_admin():
    if request.method == 'POST':
        page = create_obj(db.Page, request.form.to_dict())
        return redirect(url_for('pages_page', page_id=page.id))
    return render_template('pages/admin.html')


@app.route('/<path:path>')
def some_page(path):
    page = db.Page.find_one_or_404({'path': path, 'deleted_at': 0})
    if not page:
        abort(404)
    response = make_response(render_template('pages/page.html', page=page))
    last_modified = datetime.fromtimestamp(page.updated_at or page.created_at)
    response.headers['Last-Modified'] = last_modified
    return response
