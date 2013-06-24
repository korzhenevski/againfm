#!/usr/bin/env python
# -*- coding: utf-8 -*-

from fabric.api import env, local, run, lcd
from fabric.contrib.files import exists


def init():
    run('pip install -r {}/requirements.txt'.format(env.project))


def compass():
    local('compass watch afm/static')


def celery():
    local('celery worker --app=afm.celery -l info')


def grunt():
    if not exists('/usr/bin/grunt'):
        local('sudo npm install -g grunt-cli')
    with lcd('afm/static/js'):
        local('npm install')
        local('grunt')


def player():
    with lcd('player'):
        local('as3compile --flashversion 10 --output ../afm/static/swf/player.swf player.as')

