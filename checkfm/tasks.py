#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pymongo
import requests
from .utils import parse_playlist
from .radio import fetch_radio_stream
from .celery import celery

db = pymongo.Connection()['againfm']

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