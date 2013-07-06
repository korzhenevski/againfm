#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from afm import app, db, models

manager = Manager(app)


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
@manager.option('-key', '--key', dest='key')
def field(key):
    collection, field = key.split('/')
    for row in db[collection].find({}, fields={field: True, '_id': False}):
        try:
            print row[field]
        except UnicodeError:
            pass


@manager.command
def update_playlist():
    from afm.tasks import update_playlist

    for playlist in db.playlist.find(fields=['id']):
        print playlist['id']
        print update_playlist.delay(playlist_id=playlist['id'])


@manager.command
def sitemap():
    from flask import url_for
    from lxml import etree as ET
    from lxml.builder import E

    base = u'http://again.fm'
    urlset = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for radio in db.radio.find({'deleted_at': 0}):
        url = E.url(
            E.loc(base + url_for('radio', radio_id=radio['id'])),
        )
        urlset.append(url)

    print ET.tostring(urlset, pretty_print=True, xml_declaration=True, encoding='UTF-8')


@manager.command
def warm_cache():
    from afm import redis

    redis.delete('radio:public')
    for radio in db.Radio.find_public({'stream_type': 'audio/mpeg', 'deleted_at': 0}, fields=['id']):
        redis.sadd('radio:public', radio['id'])

    print redis.scard('radio:public'), 'public radio'


@manager.command
def update_search():
    import os

    from whoosh.fields import TEXT, Schema, NUMERIC
    from whoosh.index import create_in
    from whoosh.analysis import NgramAnalyzer

    schema = Schema(
        id=NUMERIC(int, stored=True, unique=True),
        title=TEXT(stored=True, analyzer=NgramAnalyzer(2)),
    )

    print 'update index', app.config['RADIO_INDEX']
    if not os.path.exists(app.config['RADIO_INDEX']):
        os.mkdir(app.config['RADIO_INDEX'])

    ix = create_in(app.config['RADIO_INDEX'], schema)
    writer = ix.writer()
    cursor = db.radio.find({'deleted_at': 0, 'stream_type': 'audio/mpeg'}, fields={'id': 1, 'title': 1, '_id': 0})
    for radio in cursor:
        writer.add_document(**radio)

    writer.commit(optimize=True)
    print cursor.count(), 'radio in index'


@manager.command
def init_ids():
    for klass in ['radio', 'streams', 'playlist', 'users', 'pages']:
        max_id = db[klass].find_one(fields=['id'], sort=[('id', -1)])['id'] + 1
        print klass, max_id
        db.object_ids.insert({'_id': klass, 'next': int(max_id)})


@manager.command
def smoke():
    import requests
    print 'run smoke test'

    def req(uri):
        resp = requests.get('http://againfm.dev' + uri, allow_redirects=False)
        #print resp.content
        return resp.status_code

    assert req('/') == 200
    assert req('/radio/1') == 404
    assert req('/radio/3') == 200
    assert req('/admin') == 302

    #requests.post('/_user/login', data={'login': 'test', ''})
    # TODO: to be completed

if __name__ == "__main__":
    manager.run()
