from afm import db
from . import admin
from flask import render_template
import pymongo

@admin.route('/')
def index():
    data = db.streams.aggregate([
        {'$group': {
            '_id': '$station_id',
            'streams': {
                '$push': {'url': '$url', 'is_online': '$is_online'}
            }
        }}
    ])
    res = data['result']
    stations = db.stations.find({'id': {'$in': [group['_id'] for group in res]}})
    stations = dict(((station['id'], station) for station in stations))
    list = [{'station': stations.get(group['_id']), 'streams': group['streams']} for group in res if group['streams']]
    return render_template('admin/index.html', list=list)

@admin.route('/station/<int:station_id>')
def station_details(station_id):
    station = db.Station.find_one_or_404({'id': station_id})
    streams = db.Stream.find({'station_id': station_id})
    return render_template('admin/station_details.html', station=station, streams=streams)