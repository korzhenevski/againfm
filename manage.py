#!/usr/bin/env python
# -*- coding: utf-8 -*-

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
    import urlnorm
    import re

    def fetch_xml(tuning_id):
        baseurl = 'http://pri.kts-af.net/xml/index.xml?sid=09A05772824906D82E3679D21CB1158B'
        xml = requests.get(baseurl, params={'tuning_id':tuning_id}).content
        xml = xml.replace('kb:', '').replace(' xmlns:kb="http://www.kerbango.com/xml"', '')
        return etree.fromstring(xml)

    def normalize_url(url):
        try:
            return urlnorm.norm(url)
        except urlnorm.InvalidUrl:
            pass
        return None

    def extract_streams(text):
        regex = r"(?im)^(file(\d+)=)?(http(.*?))$"
        urls = set([normalize_url(match.group(3).strip()) for match in re.finditer(regex, text)])
        return filter(None, urls)

    def import_playlist_streams(station_id, playlist_url):
        print 'fetch '+ playlist_url
        response = requests.get(playlist_url, timeout=1, config={'safe_mode': True})
        if not response.ok:
            return False
        content_type = response.headers.get('content-type', '').split(';')[0].lower()
        if content_type not in ('application/pls+xml', 'audio/x-mpegurl', 'audio/x-scpls', 'text/plain', 'audio/scpls'):
            return False
        urls = extract_streams(response.text)
        print urls
        for stream_url in urls:
            stream = db.Stream()
            stream['url'] = stream_url
            stream['station_id'] = station_id
            stream['playlist_url'] = playlist_url
            stream.save()
            print 'station {} stream {}'.format(station_id, stream['id'])

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
            #import_playlist_streams(station['id'], playlist_url)


@manager.command
def download_playlists():
    import requests
    from lxml import etree
    import urlnorm
    import re

    def normalize_url(url):
        try:
            return urlnorm.norm(url)
        except urlnorm.InvalidUrl:
            pass
        return None

    def extract_streams(text):
        regex = r"(?im)^(file(\d+)=)?(http(.*?))$"
        urls = set([normalize_url(match.group(3).strip()) for match in re.finditer(regex, text)])
        return filter(None, urls)

    def import_playlist_streams(station_id, playlist_url):
        response = requests.get(playlist_url, timeout=2, config={'safe_mode': True})
        if not response.ok:
            print response.error
            return False
        content_type = response.headers.get('content-type', '').split(';')[0].lower()
        if content_type not in ('application/pls+xml', 'audio/x-mpegurl', 'audio/x-scpls', 'text/plain', 'audio/scpls'):
            return False
        urls = extract_streams(response.text)
        for stream_url in urls:
            stream = db.Stream()
            stream['url'] = stream_url
            stream['station_id'] = station_id
            stream['playlist_url'] = playlist_url
            print stream.__dict__
            #stream.save()
            #print 'station {} stream {}'.format(station_id, stream['id'])

    from gevent.queue import Queue
    from gevent.pool import Pool

    q = Queue(50)

    def worker():
        for station_id, playlist_url in q:
            import_playlist_streams(station_id, playlist_url)

    for i in xrange(30):
        gevent.spawn(worker)

    for station in db.stations.find({'playlist':{'$exists':True}}, fields=['playlist','id']):
        q.put((station['id'], station['playlist'][0]))
        gevent.sleep(0)

    q.put(StopIteration)


if __name__ == "__main__":
    manager.run()
