#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import jsonify

from afm import app
from afm import db


@app.route('/api/radio/<int:radio_id>')
def api_radio_get(radio_id):
    radio = db.Radio.find_one_or_404({'id': radio_id, 'deleted_at': 0})
    return jsonify(radio.get_public())