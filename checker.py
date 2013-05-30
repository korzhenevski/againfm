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
pool = Pool(size=10)


def check_stream(stream):
    update = with_timeout(8, check_stream_raw, stream, timeout_value=False)
    if not update:
        print stream, 'timeout'
        return
    db.streams.update({'id': stream['id']}, {'$set': update})
    print stream, 'ok', update


def main():
    ts = time()
    where = {'checked_at': {'$lte': get_ts() - 3600}, 'deleted_at': 0}
    for stream in db.streams.find(where, fields=['id', 'url']):
        pool.spawn(check_stream, stream)
    pool.join()

    print db.streams.find(where).count()
    print time() - ts


main()