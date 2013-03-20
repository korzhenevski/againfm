#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets, models

manager = Manager(app)
manager.add_command('assets', ManageAssets(assets))

@manager.shell
def make_shell_context():
    return dict(app=app, db=db, models=models)

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


@manager.command
@manager.option('-key', '--key', dest='key')
def agg(key):
    collection, field = key.split('/')
    result = db[collection].aggregate([
        {'$group': {'_id': '$' + field, 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
    ])
    for item in result['result']:
        print '{count} {_id}'.format(**item)

@manager.command
def update_playlist():
    from afm.web.tasks import update_playlist
    for playlist in db.playlist.find(fields=['id']):
        print playlist['id']
        print update_playlist.delay(playlist_id=playlist['id'])

@manager.command
def check_stream():
    from afm.web.tasks import check_stream
    from afm.web.helpers import get_ts
    check_deadline = get_ts() - 3600
    streams = db.streams.find({'checked_at': {'$lte': check_deadline}, 'deleted_at': 0}, fields=['id'])
    for stream in streams:
        print check_stream.delay(stream_id=stream['id'])

@manager.command
def pub_radio():
    for stream in db.streams.find({'content_type': 'audio/mpeg', 'is_online': True}, fields=['radio_id']):
        db.radio.update({'id': stream['radio_id']}, {'$set': {'is_public': True}})
        print 'pub', stream['radio_id']

if __name__ == "__main__":
    manager.run()
