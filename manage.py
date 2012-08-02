#!/usr/bin/python

from flask.ext.script import Manager
from afm import app, db
from random import choice
from pprint import pprint

manager = Manager(app)

@manager.command
def gen_station():
    station = db.Station()
    station.title = u'AH.FM'
    station.website = u'http://ah.fm/'
    station.save()
    print 'station: %s' % station._id
    stream = db.Stream()
    stream.url = u'http://ru.ah.fm/'
    stream.is_shoutcast = True
    stream.station = station
    stream.save()
    print 'stream: %s' % stream._id

@manager.command
def test():
    """
    user = db.User.find_one({'email': 'yura.nevsky@gmail.com'})
    for fav in db.Favorite.find({'user_id': user._id}):
        print fav.station.title
        print fav.stream_title.title
        print 'active' if fav.is_active else 'not active'
    #pprint(db.Favorite.find_one())
    """

@manager.command
def gen():
    streams = set()
    stations = []
    tags = ['house','trance','rock','dnb','metal','psy-trance','jazz','news']
    for i in xrange(100):
        station = db.Station()
        station.title = u'Station %s' % i
        station.website = u'http://www.example.com/%s' % i
        station.save()
        print 'station %s' % station._id
        for i2 in xrange(5):
            stream = db.Stream()
            stream.station = station
            stream.url = u'http://stream%s.example.com/' % i2
            stream.save()
            streams.add(stream)
            print '- stream %s' % stream._id
        stations.append(station)
    user = db.User.find_one({'email': 'yura.nevsky@gmail.com'})
    for stream in streams:
        stream_title = db.StreamTitle()
        stream_title.stream_id = stream._id
        stream_title.title = u'Artist%s - Trackname%s' % (stream._id, stream._id)
        stream_title.save()
        print '- stream_title %s' % stream_title._id
        track = db.Track()
        track.title = stream_title.title
        track.artist, track.name = track.title.split(' - ')
        track.cover_url = u'http://example.com/cover/%s.jpg' % (stream_title._id)
        track.tags = [choice(tags).decode('utf-8') for n in xrange(5)]
        track.save()
        print '- track %s' % track._id
        stream_title.track = {
            'title': track.title,
            'cover_url': track.cover_url,
            'id': track._id
        }
        stream_title.save()
        favorite = db.Favorite()
        favorite.station = stream.station
        favorite.user_id = user._id
        favorite.stream_title = stream_title
        favorite.save()
        print '- favorite %s' % track._id

    for i in xrange(20):
        cat = db.Category()
        cat.title = u'cat %s' % i
        for i2 in xrange(500):
            cat.stations.append(choice(stations)._id)
        cat.save()
        print cat._id

    for i in xrange(10):
        cat = db.Category.find_random()
        cat.is_public = True
        cat.save()
        print cat.title

@manager.command
def clear():
    from pymongo import Connection
    connection = Connection()
    db = connection['againfm']
    for col in ('stations','streams','stream_titles','favorites','categories'):
        print 'clear %s' % col
        db[col].remove()

if __name__ == "__main__":
    manager.run()