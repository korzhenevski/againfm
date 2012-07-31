from flask import Flask
from flask.ext.login import LoginManager
from flask.ext.mongokit import MongoKit
from flask.ext.babel import Babel
from celery import Celery
from flask_debugtoolbar import DebugToolbarExtension

app = Flask(__name__)
app.config.from_pyfile('config.py')

db = MongoKit(app)
babel = Babel(app)

login_manager = LoginManager()
login_manager.setup_app(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

#toolbar = DebugToolbarExtension(app)

from . import models
from . import views
