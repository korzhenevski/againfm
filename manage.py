#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets
from datetime import datetime
from pprint import pprint
manager = Manager(app)
manager.add_command('assets', ManageAssets(assets))

@manager.command
@manager.option('-f', '--file', dest='file')
def import_genres(file):
    import yaml
    print 'importing genres...'
    for genre in yaml.load(open(file)):
        print '+ {}'.format(genre['id'])
        db.genres.find_and_modify({'id': genre['id']}, genre, upsert=True)
    print 'completed!'

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
            '_id': {'tag': '$tag', 'station_id': '$station_id'},
            'count': {'$sum': 1}
        }},
        {'$match': {
            'count': {'$gt': 1}
        }},
        {'$group': {
            '_id': '$_id.station_id',
            'tags': {'$addToSet': {'tag': '$_id.tag', 'count': '$count'}}
        }}
    ]
    data = db.onair_history.aggregate(pipeline)
    if not data['ok'] and data['errmsg']:
        print 'aggregate error: {}'.format(data['errmsg'])
        return

    tags_count = 0
    tags_stat = defaultdict(int)
    for result in data['result']:
        tags = dict([(tag['tag'], tag['count']) for tag in result['tags']])
        tags = sorted(tags, key=tags.get, reverse=True)[:5]
        for tag in tags:
            tags_stat[tag] += 1
        tags_count += len(tags)
        db.stations.update({'id': result['_id']}, {'$set': {'tags': tags}})

    print 'updated {} stations with {} tags'.format(len(data['result']), tags_count)
    #pprint(sorted(tags_stat, key=tags_stat.get, reverse=True)[:30])

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

@manager.command
@manager.option('-u', '--user', dest='login')
def change_password(login):
    user = db.User.find_login(login)
    if not user:
        print 'user not found'
        return
    password = raw_input('New password: ')
    user.set_password(password)
    user.save()
    print 'changed!'


if __name__ == "__main__":
    manager.run()
