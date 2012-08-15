#!/usr/bin/python

from flask.ext.script import Manager
from flask.ext.assets import ManageAssets
from afm import app, db, assets
from random import choice
from pprint import pprint

manager = Manager(app)
manager.add_command('assets', ManageAssets(assets))

@manager.command
def import_dump():
    with open('./afm.txt', 'r') as dump:
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
    from pymongo import Connection
    connection = Connection()
    db = connection['againfm']
    for col in ('users','stations','streams','stream_titles','favorites','categories','object_ids'):
        print 'clear %s' % col
        db[col].remove()

if __name__ == "__main__":
    manager.run()