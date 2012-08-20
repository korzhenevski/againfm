#!/usr/bin/python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets
from random import choice
from pprint import pprint
from collections import namedtuple
manager = Manager(app)
manager.add_command('assets', ManageAssets(assets))
from datetime import datetime
from zlib import crc32

def fasthash(data):
    return crc32(data) & 0xffffffff

@manager.command
def init_categories():
    def create_category(title, tags):
        cat = db.Category()
        cat.title = title
        cat.tags = tags
        cat.is_public = True
        cat.save()
        return cat

    db.categories.remove()

    categories = [
        ('Drum and Bass', ['dnb', 'drum and bass']),
        ('Trance', ['trance', 'progressive trance']),
        ('House', ['progressive house', 'house']),
        ('Relax', ['chillout', 'ambient']),
    ]

    for title, tags in categories:
        print create_category(unicode(title), map(unicode, tags))

    #for tag in db.OnairTopTag.find({'value': {'$gt': 10}}):
    #    print tag

@manager.command
def import_megadump():
    import csv
    def csv_reader(filename):
        return csv.reader(open(filename, "rb"), delimiter=',', quoting=csv.QUOTE_ALL, quotechar='"', escapechar="\\")

    StationRecord = namedtuple('Station', ['id','url','title','parent_id',
                                       'is_public','lft','rght','tree_id',
                                       'level','text','slug','long_title'])
    StreamRecord = namedtuple('Stream', ['id','url','station_id','ping','ping_job_id',
                                     'relay','publish_history','relay_on_demand','relay_metadata'])
    StationHistoryRecord = namedtuple('StationHistory', ['id','station_id','stream_id','title','title_hash',
                                                    'artist','trackname','public','track_id','created_at'])
    TrackRecord = namedtuple('Track', ['id','name','artist','artist_mbid','duration','lastfm_url','lastfm_image',
                                   'lastfm_playcount','lastfm_listeners','lastfm_data','album','album_mbid','tags',
                                   'title_hash','mbid','created_at'])

    station_lookup = {}
    stations = db.stations
    for station_data in map(StationRecord._make, csv_reader('./stations.txt')):
        station = stations.find_one({'title': station_data.title})
        if station:
            station_lookup[station_data.id] = station['id']

    stream_lookup = {}
    streams = db.streams
    for stream_data in map(StreamRecord._make, csv_reader("./streams.txt")):
        stream = streams.find_one({'url': stream_data.url})
        if stream:
            stream_lookup[stream_data.id] = stream['id']

    track_lookup = {}
    tags_lookup = {}
    track_cls = db.Track
    for track_data in map(TrackRecord._make, csv_reader("./tracks.txt")):
        print 'track %s' % track_data.id
        track = track_cls()
        track['artist'] = track_data.artist.decode('utf8')
        track['name'] = track_data.name.decode('utf8')
        track['title'] = unicode(' - '.join([track['artist'], track['name']]))
        track['rawtitle'] = track['title']
        track['image_url'] = track_data.lastfm_image.decode('utf8')
        if track_data.tags:
            track['tags'] = map(lambda x: x.decode('utf8'), track_data.tags.split(','))
        else:
            track['tags'] = []
        track['hash'] = fasthash(track['title'].encode('utf8').lower())
        track['created_at'] = datetime.strptime(track_data.created_at, '%Y-%m-%d %H:%M:%S')
        track.save()
        tags_lookup[track_data.id] = tuple(track.tags)
        track_lookup[track_data.id] = track['id']

    onair_history = db.onair_history
    for station_history in map(StationHistoryRecord._make, csv_reader("./station_history.txt")):
        if station_history.track_id not in track_lookup:
            continue
        print 'onair %s' % station_history.id
        onair_history.insert({
            'station_id': station_lookup[station_history.station_id],
            'stream_id': stream_lookup[station_history.stream_id],
            'track_id': track_lookup[station_history.track_id],
            'tags': list(tags_lookup[station_history.track_id]),
            'created_at': datetime.strptime(station_history.created_at, '%Y-%m-%d %H:%M:%S')
        })

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
def rebuild_onair_tags():
    from bson.code import Code
    mapper = Code("""
    function() {
        var station_id = this.station_id;
        this.tags.forEach(function(tag){
            emit({station_id: station_id, tag: tag}, 1);
        });
    }
    """)
    reducer = Code("""
    function(key, values) {
        var total = 0;
        for(var i = 0; i < values.length; i++) {
            total += values[i];
        }
        return total;
    }
    """)
    result = db.onair_history.map_reduce(mapper, reducer, 'onair_tags')
    print 'tags %s' % result.count()

    mapper = Code("""
    function() {
        emit(this._id.tag, 1);
    }
    """)
    reducer = Code("""
    function(key, values) {
        var total = 0;
        for(var i = 0; i < values.length; i++) {
            total += values[i];
        }
        return total;
    }
    """)
    result = db.onair_tags.map_reduce(mapper, reducer, 'onair_top_tags')
    print 'top tags %s' % result.count()


@manager.command
def import_dump():
    with open('./afm.txt') as dump:
        for line in dump:
            station_title, streams = line.strip().split('\t')
            station = db.Station()
            station['title'] = station_title.decode('utf8')
            station.save()
            for stream_url in streams.split(','):
                stream = db.Stream()
                stream['url'] = unicode(stream_url.strip())
                stream['station_id'] = station['id']
                stream.save()
                print '- %s: %s' % (stream['_id'], stream_url)
            print station['_id']

@manager.command
def clear():
    for col in ('users','stations','streams','stream_titles','favorites','categories','object_ids'):
        print 'clear %s' % col
        db[col].remove()

if __name__ == "__main__":
    manager.run()
