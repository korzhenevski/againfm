#!/usr/bin/env python
# -*- coding: utf-8 -*-
from afm import app, celery, mailer, db
from .radio import fetch_playlist, fetch_stream


@celery.task
def send_mail(email, body, subject=None):
    if subject is None:
        subject = app.config['DEFAULT_MAIL_SUBJECT']
    result = mailer.send_email(
        source=app.config['DEFAULT_MAIL_SENDER'],
        subject=subject, body=body, to_addresses=[email], format='html')
    return result


@celery.task(ignore_result=True)
def update_playlist(playlist_id):
    from .helpers import get_ts
    with app.test_request_context():
        playlist = db.playlist.find_one({'id': playlist_id, 'deleted_at': 0})
        if not playlist:
            return

        # скачиваем плейлист и парсим ссылки на потоки
        result = fetch_playlist(playlist['url'])
        db.playlist.update({'id': playlist_id}, {'$set': {
            'streams': result.urls,
            'updated_at': get_ts(),
            'update': {
                'error': result.error,
                'content_type': result.content_type,
                'time': result.time,
            },
        }})

        # добавление потоков
        db.Stream.bulk_add(playlist['radio_id'], result.urls, playlist_id=playlist['id'])


@celery.task(ignore_result=True)
def check_stream(stream_id):
    from .helpers import get_ts
    with app.test_request_context():
        stream = db.streams.find_one({'id': stream_id, 'deleted_at': 0}, fields=['id', 'url'])
        if not stream:
            return
        result = fetch_stream(stream['url'])
        check_result = {
            'bitrate': result.bitrate,
            'content_type': result.content_type,
            'is_shoutcast': result.is_shoutcast,
            'meta': result.meta,
            'check': {
                'error': result.error,
                'time': result.time,
                'headers': result.headers
            },
            'checked_at': get_ts(),
        }
        db.streams.update({'id': stream['id']}, {'$set': check_result})
