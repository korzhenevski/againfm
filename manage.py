#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets, models
from pprint import pprint as pp

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
def pr():
    for item in db.streams.find({'meta.name': {'$exists': True}}, fields=['meta.name']):
        print item['meta']['name']

@manager.command
def research():
    for item in db.streams.find({'meta.name': {'$exists': True}}):
        print len(item['meta']['name'])

@manager.command
def feed_search():
    import requests
    import ujson as json
    #feed_url = 'http://localhost:9200/afm/radio/{}'
    #for radio in db.Radio.find():
    #    print requests.post(feed_url.format(radio['id']), data=json.dumps(radio.get_public()))
    """
    analyzer = {'autocomplete': {
        "type": "custom",
        "tokenizer": "standard",
        "filter": ["standard", "lowercase", "stop", "kstem", "ngram"]
    }}
    resp = requests.put('http://localhost:9200/afm/radio/_settings', data=json.dumps({'analysis': {'analyzer': analyzer}}))
    """
    mapping = {
        "title": {
            "type": "multi_field",
            "fields": {
                "title": {
                    "type": "string"
                },
                "autocomplete": {
                    "analyzer": "autocomplete",
                    "type": "string"
                }
            }
        },
    }
    resp = requests.put('http://localhost:9200/afm/radio/_mapping', data=json.dumps({
        'radio': {'properties': mapping}
    }))

    print resp
    print resp.json()

if __name__ == "__main__":
    manager.run()
