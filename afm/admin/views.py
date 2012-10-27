from afm import db
from . import admin
from flask import request, render_template, jsonify

@admin.route('/')
def index():
    data = db.streams.aggregate([
        {'$group': {
            '_id': '$station_id',
            'streams': {
                '$push': {'url': '$url', 'is_online': '$is_online', 'check_error': '$check_error'}
            }
        }}
    ])
    res = data['result']
    stations = db.stations.find({'id': {'$in': [group['_id'] for group in res]}})
    stations = dict(((station['id'], station) for station in stations))
    list = [{'station': stations.get(group['_id']), 'streams': group['streams']} for group in res if group['streams']]
    return render_template('admin/index.html', list=list)

@admin.route('/import')
def import_data():
    return render_template('admin/import.html')

@admin.route('/import/fetch')
def import_fetch():
    from .source_parser import parse_source
    streams = parse_source(request.args['url'], stream_list=True)
    streams = [{'url': url} for url in streams]
    return jsonify({'streams': streams})

@admin.route('/import/station/streams/<int:station_id>')
def import_station_streams(station_id):
    streams = [{'url': stream['url']} for stream in db.streams.find({'station_id': station_id})]
    return jsonify({'streams': streams})

@admin.route('/import/station/save', methods=['POST'])
def import_station_save():
    data = request.json

    if 'id' in data:
        station = db.Station.find_one_or_404({'id': data['id']})
        streams = [stream['url'] for stream in db.streams.find({'station_id': station['id']})]
    else:
        station = db.Station()
        station.title = unicode(data['title'])
        station.tags = [unicode(tag).strip() for tag in data['tags']]
        station.save()
        streams = []

    streams = set(data['streams']).difference(streams)
    for stream_url in streams:
        stream = db.Stream()
        stream.url = unicode(stream_url)
        stream.station_id = station['id']
        stream.save()

    return jsonify({'station_id': station['id']})

@admin.route('/station/<int:station_id>')
def station_details(station_id):
    station = db.Station.find_one_or_404({'id': station_id})
    streams = db.Stream.find({'station_id': station_id})
    return render_template('admin/station_details.html', station=station, streams=streams)