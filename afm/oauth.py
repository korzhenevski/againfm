#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask_oauth import OAuth

oauth = OAuth()

vk = oauth.remote_app('vk',
    base_url='https://api.vk.com/method/',
    request_token_url=None,
    authorize_url='http://api.vk.com/oauth/authorize',
    access_token_url='https://api.vk.com/oauth/access_token',
    consumer_key='3547691',
    consumer_secret='GvHxfX1OKYqR0fMrtQ7j',
    request_token_params={
        'scope': 'friends,audio,status,offline',
        'response_type': 'code'
    }
)