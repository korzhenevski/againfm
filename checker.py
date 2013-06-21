#!/usr/bin/env python
# -*- coding: utf-8 -*-

from gevent import monkey
from gevent.timeout import with_timeout
monkey.patch_all()

from time import time
from pymongo import Connection
from gevent.pool import Pool

from afm.helpers import get_ts
from afm.tasks import check_stream_raw

db = Connection(use_greenlets=True)['againfm']
pool = Pool(size=25)


def check_stream(stream):
    update = with_timeout(8, check_stream_raw, stream, timeout_value=False)
    if not update:
        print stream, 'timeout'
        return
    db.streams.update({'id': stream['id']}, {'$set': update})
    print stream['id']


def update_check_info():
    res = db.streams.aggregate([
        {'$match': {
            'content_type': {'$exists': True, '$ne': ''}
        }},
        {'$group': {
            '_id': '$radio_id',
            'stream_type': {'$addToSet': '$content_type'}
        }}
    ])

    ts = get_ts()
    for item in res['result']:
        db.radio.update({'id': item['_id']}, {'$set': {
            'stream_type': item['stream_type'],
            'check_at': ts
        }})

    print len(res['result']), 'online radio (', db.radio.find({'deleted_at': 0}).count(), 'total )'
    db.radio.update({'check_at': {'$ne': ts}}, {'$set': {'stream_type': [], 'check_at': ts}}, multi=True)


def main():
    ts = time()
    where = {'checked_at': {'$lte': get_ts() - 600}, 'deleted_at': 0}
    for stream in db.streams.find(where, fields=['id', 'url']).sort('checked_at', 1):
        pool.spawn(check_stream, stream)
    pool.join()

    update_check_info()
    print time() - ts


main()