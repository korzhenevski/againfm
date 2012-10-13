#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets
from datetime import datetime

manager = Manager(app)
manager.add_command('assets', ManageAssets(assets))

@manager.command
def rebuild_tags():
    from collections import defaultdict
    pipeline = [
        {'$project': {
            'tag': '$tags',
            'station_id': 1
        }},
        {'$unwind': '$tag'},
        {'$group': {
            '_id': {'tag':'$tag', 'station_id':'$station_id'},
            'count': {'$sum': 1}
        }},
        {'$sort': {'count': -1}},
        {'$group': {
            '_id': '$_id.station_id',
            'tag': {'$first': '$_id.tag'}
        }},
        {'$project': {
            '_id': 0, 'station_id': '$_id', 'tag': 1
        }}
    ]

    data = db.onair_history.aggregate(pipeline)
    if not data['ok'] and data['errmsg']:
        print 'aggregate error: {}'.format(data['errmsg'])
        return

    tags = defaultdict(int)
    for result in data['result']:
        tags[result['tag']] += 1
        db.stations.find_and_modify({'id': result['station_id']}, {
            '$set': {'tag': result['tag']}
        })
        print 'station {station_id}: tag {tag}'.format(**result)

    for tag, tag_count in tags.iteritems():
        station_tag = db.StationTag.find_one({'tag': tag})
        if station_tag:
            station_tag['count'] = tag_count
            station_tag['updated_at'] = datetime.now()
        else:
            station_tag = db.StationTag()
            station_tag['tag'] = tag
            station_tag['count'] = tag_count
        station_tag.save()
        print 'tag {}: count {}'.format(tag, tag_count)

@manager.command
def ensure_indexes():
    for model_cls in db.__dict__['registered_documents']:
        if not (hasattr(model_cls, 'indexes') and model_cls.indexes):
            continue
        collection = db[model_cls.__collection__]
        print 'create indexes for %s' % model_cls.__collection__
        for index in model_cls.indexes:
            if isinstance(index['fields'], list):
                fields = zip(index['fields'], [1] * len(index['fields']))
                print_fields = ', '.join(index['fields'])
            else:
                fields = [(index['fields'], 1)]
                print_fields = index['fields']
            print '- %s (unique: %s)' % (print_fields, index.get('unique', False))
            collection.ensure_index(fields, unique=index.get('unique'), dropDups=True)
        print ''

@manager.command
def clear():
    for col in ('users','stations','streams','stream_titles','favorites','categories','object_ids'):
        print 'clear %s' % col
        db[col].remove()

@manager.command
def gen():
    from time import time
    from random import randint, choice
    import string
    ts = int(time())
    db.favorite_tracks.remove({'user_id': 65})
    randstr = lambda: unicode(string.join([choice(string.ascii_lowercase) for i in xrange(randint(4, 20))], ''))
    for i in xrange(1000):
        fav = db.FavoriteTrack()
        fav['user_id'] = 65
        fav['station'] = {'id': 10, 'title': randstr()}
        track = u'{} - {}'.format(randstr(), randstr())
        fav['track'] = {'id': 1000, 'title': track}
        fav['track']['artist'], fav['track']['name'] = track.split(u' - ')
        fav['favorite'] = bool(i % 3)
        fav['created_at'] = ts + randint(-10, 10) * 86400 + randint(0, 86400)
        fav.save()
        print fav._id

if __name__ == "__main__":
    manager.run()
