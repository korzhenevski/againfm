from flask import Flask
from flask.ext.login import LoginManager
from flask.ext.mongokit import MongoKit
from flask.ext.babel import Babel
from celery import Celery

app = Flask(__name__)
app.config.from_pyfile('config.py')

db = MongoKit(app)
babel = Babel(app)

login_manager = LoginManager()
login_manager.setup_app(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

from . import models
from . import views
