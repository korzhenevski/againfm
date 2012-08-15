from flask import Flask
from flask.ext.login import LoginManager
from flask.ext.mongokit import MongoKit
from flask.ext.babel import Babel
from celery import Celery
from flask.ext.assets import Environment, Bundle
from flask_debugtoolbar import DebugToolbarExtension

app = Flask(__name__)
app.config.from_pyfile('config.py')

db = MongoKit(app)
babel = Babel(app)

login_manager = LoginManager()
login_manager.setup_app(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

assets = Environment(app)

js = Bundle(
    'js/jquery-ui-1.8.16.custom.min.js',
    'js/jquery.watermark.js',
    'js/jquery.validate.js',
    'js/jquery.cookie.js',
    'js/jquery.tinyscrollbar.js',
    'js/bootstrap-button.js',
    'js/underscore.js',
    'js/backbone.js',
    'js/handlebars.js',
    'js/render.js',
    'js/utils.js',
    'js/comet.js',
    'js/swfobject.js',
    'js/main.js',
    filters='uglifyjs', output='js/packed.%(version)s.js')
assets.register('js_all', js)

#toolbar = DebugToolbarExtension(app)

from . import models
from . import views
