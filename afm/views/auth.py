#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import request, jsonify, url_for, redirect
from flask import session

from afm import app
from afm.oauth import vk


@vk.tokengetter
def get_vk_token(token=None):
    return session.get('vk', {}).get('access_token')


@app.route('/vk')
def vk_auth():
    return vk.authorize(callback=url_for('oauth', _external=True))


@app.route('/oauth')
@vk.authorized_handler
def oauth(resp):
    next_url = request.args.get('next') or url_for('index')
    if resp is None:
        return redirect(next_url)
    session['vk'] = resp
    return jsonify({'resp': resp})


@app.route('/vk/audio')
def vk_audio():
    import requests

    resp = requests.get('https://api.vk.com/method/audio.get', params={'access_token': get_vk_token()})
    return jsonify({'data': resp.json()})
