#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pymongo
import requests
from afm import app, celery, mailer
from .utils import parse_playlist
from celery import subtask, group
from .radio import fetch_radio_stream

db = pymongo.Connection()['againfm']

@celery.task
def send_mail(email, body, subject=None):
    if subject is None:
        subject = app.config['DEFAULT_MAIL_SUBJECT']
    result = mailer.send_email(
        source=app.config['DEFAULT_MAIL_SENDER'],
        subject=subject, body=body, to_addresses=[email], format='html')
    return result


@celery.task
def fetch_playlist(url):
    headers = {'User-Agent': 'Winamp'}
    response = requests.get(url, timeout=5, headers=headers, stream=True)
    content_type = response.headers.get('content-type', '').split(';')[0].lower()
    if content_type not in (
        'audio/x-mpegurl', 'audio/x-scpls', 'application/pls+xml', 'audio/scpls',
        'text/html', 'text/plain', 'audio/scpls', 'audio/mpegurl'
    ):
        return
    #content_len = int(response.headers.get('content-length', 0))
    #if content_len == 0 or content_len >= 128 * 1024:
    #    raise ValueError('Wrong content length: {}'.format(content_len))
    urls = parse_playlist(response.text)
    from collections import defaultdict
    group = defaultdict(dict)
    for url in urls:
        data = fetch_radio_stream(url)
        icy_name = data['headers']

    db.radio.update({'playlist': url}, {'$set': {'playlist_content': {
        'content_type': content_type,
        'headers': response.headers,
        'urls': urls
    }}})


@celery.task
def fetch_stream_info(url):
    return {'bitrate': 320}