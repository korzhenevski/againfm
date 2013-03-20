#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import absolute_import

import pymongo
from celery import group, chord, chain, subtask
from .radio import fetch_playlist, fetch_stream
from .celery import celery
from time import time
from pprint import pprint as pp
db = pymongo.Connection()['againfm']

@celery.task(name='update_playlist')
def update_playlist(playlist_id):
    playlist = db.playlist.find_one({'id': playlist_id}, fields=['url', 'radio_id'])
    if not playlist:
        return
    result = fetch_playlist(playlist['url'])
    db.playlist.update({'id': playlist_id}, {'$set': {
        'streams': result.urls,
        'updated_at': int(time()),
        'fetch': {'error': result.error, 'time': result.time},
    }})
    return result.urls

@celery.task(name='finalize_check_streams')
def finalize_check_streams(results, radio_id):
    print 'RADIO_ID', radio_id
    print 'results', results
    return results

@celery.task(name='check_stream')
def check_stream(url):
    return fetch_stream(url)

@celery.task(name='check_playlist')
def check_playlist(urls):
    return (group([check_stream.s(url) for url in urls]) | finalize_check_streams.s())()

if __name__ == '__main__':
    process = (update_playlist.s(playlist_id=1172) | check_playlist.s())
    print process()
    #print check_playlist(['http://nl2.ah.fm:9000/', 'http://nl2.ah.fm:9000/']).get()
    #print check_playlist(['http://nl2.ah.fm:9000/', 'http://nl2.ah.fm:9000/']).get()
    #print fetch_stream('http://relay.birdlab.ru:8000/trigger').meta
    #print process.apply_async()
    #print update_playlist(playlist_id=27)
    #print check_stream('http://nl2.ah.fm:9000/')
    #print update_playlist_streams(playlist_id=27)

