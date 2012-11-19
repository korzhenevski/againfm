#!/usr/bin/env python
# -*- coding: utf-8 -*-

import string
from pprint import pprint
from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets
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

@manager.command
def itunes():
    import requests
    from lxml import etree

    def fetch_xml(tuning_id):
        baseurl = 'http://pri.kts-af.net/xml/index.xml?sid=09A05772824906D82E3679D21CB1158B'
        xml = requests.get(baseurl, params={'tuning_id':tuning_id}).content
        xml = xml.replace('kb:', '').replace(' xmlns:kb="http://www.kerbango.com/xml"', '')
        return etree.fromstring(xml)

    results = fetch_xml('1').find('results')
    top_genres = [(item.find('menu_id').text, item.find('name').text) for item in results.findall('menu_record')]
    top_genres = dict(top_genres)

    for genre_id, genre_title in top_genres.iteritems():
        print '- ' + genre_title
        genre = fetch_xml(genre_id)
        for station_item in genre.find('results').findall('station_record'):
            url_record = station_item.find('station_url_record')
            bitrate = int(url_record.find('bandwidth_kbps').text)
            playlist_url = unicode(url_record.find('url').text.strip())
            if not playlist_url.startswith('http://'):
                playlist_url = 'http://' + playlist_url
            station = db.Station()
            station.update({
                'title': unicode(station_item.find('station').text),
                'playlist': [playlist_url],
                'itunes': {
                    'description': station_item.find('description').text,
                    'bitrate': bitrate,
                    'id': station_item.find('esid').text,
                    'genre': genre_title,
                    'genre_id': genre_id
                }
            })
            station.save()
            print station['id']

@manager.command
def housekeep_streams():
    station_ids = [station['id'] for station in db.stations.find({}, fields=['id'])]
    db.streams.remove({'station_id': {'$nin': station_ids}})

@manager.command
@manager.option('-s', '--station_id', dest='station_id')
def radio(station_id=None):
    req = lambda prompt: raw_input(prompt).decode('utf8')
    station = db.Station()
    if station_id:
        print '- Edit radio #{}'.format(station_id)
        station = db.Station.find_one({'id': int(station_id)})
        if not station:
            print 'station not found'
            return
        pprint(station)
    else:
        print '- Add radio'
    title = req('title: ')
    if title:
        station['title'] = title.strip()
    tags = req('tags: ')
    if tags:
        tags = tags.split(',')
        tags = map(string.strip, tags)
        station['tags'] = tags
    status = req('status: ')
    if status:
        station['status'] = int(status)
    screen_name = req('screen_name: ')
    if screen_name:
        station['screen_name'] = screen_name.strip()
    if not station_id and not station['title']:
        print 'error: title for new station required'
        return
    station.save()
    print '- station_id: {}'.format(station['id'])
    while True:
        stream = db.Stream()
        stream['station_id'] = station['id']
        stream_url = req('stream: ')
        if not stream_url:
            break
        if not stream_url.startswith('http://'):
            print 'stream url must be start from "http://"'
            break
        stream['url'] = stream_url
        stream.save()
        print '- stream_id: {}'.format(stream['id'])

@manager.command
@manager.option('-id', '--station_id', dest='station_id')
def remove_radio(station_id):
    station_id = int(station_id)
    station = db.Station.find_one({'id': station_id})
    if not station:
        print 'station not found'
        return
    station.soft_delete()
    print 'station {} deleted'.format(station_id)

    for stream in db.Stream.find({'station_id': station_id}):
        stream.soft_delete()
        print '- stream {} deleted'.format(stream['id'])



@manager.command
def convert_streams():
    for old_stream in db.streams2.find():
        stream = db.Stream()
        stream['id'] = old_stream['id']
        stream['url'] = old_stream['url']
        stream['station_id'] = old_stream['station_id']
        stream.save()
        print stream['id']

@manager.command
def convert_stations():
    for old_station in db.stations2.find():
        station = db.Station()
        station['id'] = int(old_station['id'])
        station['tags'] = old_station.get('tags', [])
        station['streams'] = old_station['streams']
        station['title'] = old_station['title']
        station['status'] = int(old_station['status'])
        station.save()
        print station['id']

@manager.command
def housekeep_stations():
    ids = set()
    for stream in db.streams.find({}, fields=['id','station_id']):
        ids.add(stream['station_id'])

    disable_ids = set()
    for station in db.stations.find({'status': {'$ne': 0}}, fields=['id']):
        if station['id'] not in ids:
            disable_ids.add(station['id'])

    print disable_ids
    db.stations.update({'id': {'$in': list(disable_ids)}}, {'$set': {'status': 0, 'streams': []}}, multi=True)

if __name__ == "__main__":
    manager.run()
