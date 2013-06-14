#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template, request, redirect, url_for, make_response
from datetime import datetime

from afm import app, db
from afm.models import create_obj
from afm.views.user import admin_required

@app.route('/blog')
def blog():
    posts = db.BlogPost.find_public().sort('created_at', -1)
    return render_template('blog/blog.html', posts=posts)


@app.route('/blog/admin', methods=['GET', 'POST'])
@admin_required
def blog_admin():
    if request.method == 'POST':
        post = create_obj(db.BlogPost, request.form.to_dict())
        return redirect(url_for('blog_post', post_id=post.id))
    return render_template('blog/admin.html')


@app.route('/blog/<int:post_id>')
def blog_post(post_id):
    post = db.BlogPost.find_one_or_404({'id': post_id, 'deleted_at': 0})
    response = make_response(render_template('blog/post.html', post=post))
    last_modified = datetime.fromtimestamp(post.updated_at or post.created_at)
    response.headers['Last-Modified'] = last_modified
    return response