#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from afm import app, db, models
from pprint import pprint as pp

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
def update_playlist():
    from afm.tasks import update_playlist
    for playlist in db.playlist.find(fields=['id']):
        print playlist['id']
        print update_playlist.delay(playlist_id=playlist['id'])


@manager.command
def check_stream():
    from afm.tasks import check_stream
    from afm.helpers import get_ts
    check_deadline = get_ts() - 3600
    streams = db.streams.find({'checked_at': {'$lte': check_deadline}, 'deleted_at': 0}, fields=['id'])
    for stream in streams:
        print check_stream.delay(stream_id=stream['id'])


@manager.command
def update_places():
    access_token = '56fd22cacbc4b5d67d429d3030cb913df2000f9c7f7d8be1459c80515884b7624db30424a926820c04d44'
    import requests
    db.countries.drop()
    db.regions.drop()
    db.cities.drop()
    from time import sleep

    def call_method(name, **params):
        params['access_token'] = access_token
        tries = 10
        resp = None
        while tries:
            tries -= 1
            resp = requests.get('https://api.vk.com/method/' + name, params=params)
            data = resp.json()
            if 'error' in data and data.get('error').get('error_code') == 6:
                print 'sleep...'
                sleep(2)
                continue
            break
        if resp is None:
            raise RuntimeError('too many tries')
        return resp.json().get('response', [])

    countries = call_method('places.getCountries', need_full=1)
    for country in countries:
        print country['cid']
        print db.countries.insert({'_id': country['cid'], 'title': country['title']})
        regions = call_method('places.getRegions', country=country['cid'])
        for region in regions:
            print('- region', region['region_id'])
            print db.regions.insert({'_id': region['region_id'], 'country_id': country['cid'], 'title': region['title']})
        cities = call_method('places.getCities', country=country['cid'])
        for city in cities:
            city['country_id'] = country['cid']
            print('- city', city['cid'])
            db.cities.insert(city)

@manager.command
def sitemap():
    from flask import url_for
    from lxml import etree as ET
    from lxml.builder import E, ElementMaker
    base = u'http://again.fm'
    urlset = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for radio in db.radio.find({'deleted_at': 0}):
        url = E.url(
            E.loc(base + url_for('radio_page', radio_id=radio['id'])),
        )
        urlset.append(url)
    print ET.tostring(urlset, pretty_print=True, xml_declaration=True, encoding='UTF-8')


@manager.command
def update_search():
    from afm import search
    for radio in db.Radio.find_public():
        print radio.push_to_search()
    print search.refresh()


@manager.command
def update_cache():
    from afm import redis
    from time import time

    ts = time()
    redis.delete('radio:public')
    for radio in db.Radio.find_public(fields=['id']):
        redis.sadd('radio:public', radio['id'])
    print time() - ts


@manager.command
def get_icy_genre():
    import string
    from collections import Counter
    c = Counter()
    for stream in db.streams.find({'meta.genre': {'$exists': True}}):
        genre = stream['meta']['genre']
        for token in map(string.lower, genre.split(',')):
            c[token.strip()] += 1

    for k, v in c.most_common(100):
        print k

@manager.command
def ctrl_search():
    settings = {
        "analysis": {
            "filter": {
                "ngram_filter": {
                    "min_gram": 3,
                    "max_gram": 8,
                    "type": "nGram"
                }
            },
            "analyzer": {
                "ngram_analyzer": {
                    "tokenizer": "lowercase",
                    "filter": ["ngram_filter"],
                    "type": "custom",
                }
            }
        }
    }

    import requests
    import json
    print requests.delete('http://192.168.2.2:9200/againfm').json()
    pp(requests.post('http://192.168.2.2:9200/againfm', data=json.dumps({'settings': settings})).json())
    maping = {
        'properties': {
            'title': {
                'type': 'string',
                'analyzer': 'ngram_analyzer'
            }
        }
    }
    pp(requests.put('http://192.168.2.2:9200/againfm/radio/_mapping', data=json.dumps({'radio': maping})).json())

    print requests.get('http://192.168.2.2:9200/againfm/_settings').json()
    print requests.get('http://192.168.2.2:9200/againfm/_mapping').json()
    #print requests.post('http://192.168.2.2:9200/test/_refresh').json()

if __name__ == "__main__":
    manager.run()
