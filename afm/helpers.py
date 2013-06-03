#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logging
import validictory
import ujson as json
from flask import request, abort, current_app, Response
from datetime import date
from time import time
from urlparse import urlparse, urljoin
from flask import url_for, redirect

from afm import tasks, redis


def get_onair(radio_id):
    print 'radio:{}:onair'.format(radio_id)
    air = redis.get('radio:{}:onair'.format(radio_id))
    air = json.loads(air) if air else {}
    return air


class RedirectResponse(Response):
    default_status = 302
    autocorrect_location_header = False


def raw_redirect(location):
    response = RedirectResponse()
    response.headers['Location'] = location.encode('utf8')
    return response


def naturalday(ts, ts_format=None):
    delta = ts.date() - date.today()
    if not delta.days:
        return u'Сегодня'
    elif delta.days == 1:
        return u'Завтра'
    elif delta.days == -1:
        return u'Вчера'
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
    res = {}
    for name, val in obj.iteritems():
        # оставлем только описанные в схеме
        if name in props:
            # строки принудительно приводим в юникод
            res[name] = unicode(val) if props[name].get('type') == 'string' else val
    return res


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


def is_safe_url(target):
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and \
           ref_url.netloc == test_url.netloc


def get_redirect_target():
    for target in request.values.get('next'), request.referrer:
        if not target:
            continue
        if is_safe_url(target):
            return target


def redirect_back(endpoint, **values):
    target = request.form['next']
    if not target or not is_safe_url(target):
        target = url_for(endpoint, **values)
    return redirect(target)