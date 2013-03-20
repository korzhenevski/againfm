#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logging
import validictory
from flask import request, abort, current_app
from datetime import date
from afm.web import tasks
from time import time

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
    if not current_app.config['SEND_MAIL']:
        # don't send mail in debug env
        return
    return tasks.send_mail.delay(**kwargs)

def safe_input_field(field, schema):
    data = safe_input_object({field: schema})
    return data[field]

def safe_input_object(schema, **kwargs):
    props = {}
    for k, v in schema.iteritems():
        if isinstance(v, str):
            props[k] = {'type': v}
        else:
            props[k] = v
    obj = safe_input({'type': 'object', 'properties': props}, **kwargs)
    # фильтруем все поля не описанные в схеме
    return dict([(k, v) for k, v in obj.iteritems() if k in props])

def safe_input(schema, data=None, **kwargs):
    data = data or request.json or request.form.to_dict()
    try:
        validictory.validate(data, schema=schema, **kwargs)
        return data
    except ValueError, error:
        logging.exception(error)
        abort(400)
    return None

# адрес почтового инбокса по домену провайдера
def get_email_provider(email):
    email_domain = email.split('@')[1].lower()
    for domain, domains in current_app.config['EMAIL_PROVIDERS'].items():
        if email_domain in domains:
            return u'http://{}/'.format(domain)
    return None

def get_ts():
    return int(time())