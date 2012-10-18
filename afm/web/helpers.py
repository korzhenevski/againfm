#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logging
import validictory
from . import app
from flask import  request, abort
from datetime import date
from afm.web import tasks

def naturalday(ts, ts_format=None):
    delta = ts.date() - date.today()
    if not delta.days:
        return u'today'
    elif delta.days == 1:
        return u'tomorrow'
    elif delta.days == -1:
        return u'yesterday'
    return ts.strftime(ts_format)

def send_mail(**kwargs):
    if app.debug:
        # don't send mail in debug env
        return
    return tasks.send_mail.delay(**kwargs)

def safe_input_field(field, schema):
    object_schema = {}
    object_schema[field] = schema
    data = safe_input_object(object_schema)
    return data[field]

def safe_input_object(schema, **kwargs):
    properties = {}
    for k, v in schema.iteritems():
        if isinstance(v, str):
            properties[k] = {'type': v}
        else:
            properties[k] = v
    object = safe_input({'type': 'object', 'properties': properties}, **kwargs)
    # фильтруем все поля не описанные в схеме
    return dict([(k, v) for k, v in object.iteritems() if k in properties])

def safe_input(schema, data=None, **kwargs):
    data = data or request.json or request.form.to_dict()
    try:
        validictory.validate(data, schema=schema, **kwargs)
        return data
    except ValueError, error:
        logging.exception(error)
        print data
        abort(400)
    return None

# HTTP-адрес инбокса по почтовому ящику
def get_email_provider(email):
    domain = email.split('@')[1].lower()
    for link, domains in app.config['EMAIL_PROVIDERS'].items():
        if domain in domains:
            return link
    return None