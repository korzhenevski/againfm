#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import Flask
from celery import Celery
from flask.ext.login import LoginManager
from flask.ext.mongokit import MongoKit
from flask.ext.assets import Environment, Bundle
from flask_debugtoolbar import DebugToolbarExtension
from redis import Redis
from .i18n import I18n

app = Flask(__name__)
app.config.from_pyfile('config.py')

db = MongoKit(app)
i18n = I18n(app)

redis = Redis(**app.config['REDIS'])

login_manager = LoginManager()
login_manager.init_app(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

assets = Environment(app)

assets.register('core_scripts', Bundle(
    'js/libs/jquery.min.js',
    'js/libs/jquery-ui-1.8.23.custom.min.js',
    # jquery-ui touch events support
    'js/libs/jquery.ui.touch-punch.js',
    'js/libs/lodash.underscore.min.js',
    'js/libs/backbone.js',
    # radio-display
    'js/libs/jquery.tinyscrollbar.js',
    'js/libs/jquery.textchange.js',
    #'js/libs/jquery.transition.js',
    'js/libs/bootstrap-button.js',
    # radio-player
    'js/libs/swfobject.js',
    # for production with precompiled templates only include tiny handlerbars.runtime.js
    #'js/handlebars.runtime.js',
    #'js/render.js',
    'js/libs/handlebars.js',
    'js/libs/jquery.cookie.js',
    'js/libs/comet.js',
    filters='uglifyjs', output='js/deploy/core.%(version)s.js'))

assets.register('scripts', Bundle(
    'js/app/app.js',
    'js/app/radio-display.js',
    'js/app/radio-player.js',
    'js/app/radio-sticker.js',
    #'js/app/radio-spectrum.js',
    'js/app/form-validator.js',
    'js/app/user-pages.js',
    'js/app/user-topbox.js',
    'js/app/user.js',
    'js/app/site-common.js',
    'js/app/router.js',
    filters='uglifyjs', output='js/deploy/app.%(version)s.js'))

if app.config['TESTING']:
    from flask.ext.jasmine import Jasmine, Asset
    jasmine = Jasmine(app)
    jasmine.specs(
        'js/specs/radio-display.js',
    )
    jasmine.sources('js/sinon-1.4.2.js', Asset('core_scripts'), Asset('scripts'))

#toolbar = DebugToolbarExtension(app)

from . import models, views, api

