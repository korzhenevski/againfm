#!/usr/bin/env python
# -*- coding: utf-8 -*-

from afm import db, app
from . import admin
from flask import request, render_template, jsonify, redirect
from flask.ext.login import current_user

if not app.debug:
    # закрываем админку в продакшене
    @admin.before_request
    def restrict_to_admins():
        if not (current_user.is_authenticated() and current_user.is_admin()):
            return redirect('/')

@admin.route('/')
def radio():
    context = {}
    context['radio_list'] = []
    return render_template('admin/radio.html', **context)
