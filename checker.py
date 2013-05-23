#!/usr/bin/env python
# -*- coding: utf-8 -*-

from gevent import monkey
monkey.patch_all()

from pymongo import Connection
from gevent.pool import Pool

from afm.helpers import get_ts
from afm.tasks import check_stream_raw

db = Connection(use_greenlets=True)['againfm']
pool = Pool(size=50)


def check_stream(stream):
    update = check_stream_raw(stream)
    db.streams.update({'id': stream['id']}, {'$set': update})
    print stream['id'], 'ok'


where = {'checked_at': {'$lte': get_ts() - 3600}, 'deleted_at': 0}
for stream in db.streams.find(where, fields=['id', 'url']):
    pool.spawn(check_stream, stream)

pool.join()