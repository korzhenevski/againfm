#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import render_template
from afm import app


@app.route('/admin')
def admin():
    return render_template('admin.html')
