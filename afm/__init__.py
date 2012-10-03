import json
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
login_manager.setup_app(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

assets = Environment(app)

js = Bundle(
    'js/jquery-ui-1.8.23.custom.min.js',
    'js/jquery.watermark.js',
    'js/jquery.validate.js',
    'js/jquery.cookie.js',
    'js/i18next-1.5.5.js',
    'js/bootstrap-button.js', # lazy
    'js/underscore.js',
    'js/backbone.js',
    'js/handlebars.js',
    'js/template.js',
    'js/common.js',
    'js/comet.js', # lazy
    'js/app/base.js',
    'js/app/radio.js',
    'js/app/user.js',
    'js/app/site.js',
    'js/app/setup.js',
filters='uglifyjs', output='js/deploy/afm-packed.%(version)s.js')

assets.register('core_scripts', Bundle(
    'js/jquery.min.js',
    'js/jquery-ui-1.8.23.custom.min.js',
    'js/jquery.ui.touch-punch.js',
    'js/i18next-1.5.5.js',
    'js/underscore.js',
    'js/backbone.js',
    # radio-display
    'js/jquery.tinyscrollbar.js',
    # radio-player
    'js/swfobject.js',
    # for production with precompiled templates only include tiny handlerbars.runtime.js
    'js/handlebars.js',
))

assets.register('scripts', Bundle(
    'js/app/app.js',
    'js/app/radio-display.js',
    'js/app/radio-player.js',
))

if app.config['TESTING']:
    from flask.ext.jasmine import Jasmine, Asset
    jasmine = Jasmine(app)
    jasmine.specs(
        'js/specs/radio-display.js',
    )
    jasmine.sources('js/sinon-1.4.2.js', Asset('core_scripts'), Asset('scripts'))

#toolbar = DebugToolbarExtension(app)

from . import models
from . import views
