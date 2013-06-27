#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import Flask
from celery import Celery
from flask.ext.login import LoginManager
from flask.ext.mongokit import MongoKit
from flask.ext.misaka import Misaka
from redis import Redis
from .mailer import AmazonMailer

app = Flask(__name__)

app.config.from_pyfile('config.py')
app.config.from_pyfile('local_config.py', silent=True)
app.config.from_envvar('AFM_CONFIG', silent=True)

app.jinja_env.variable_start_string = '{{{'
app.jinja_env.variable_end_string = '}}}'
app.jinja_env.block_start_string = '{{%'
app.jinja_env.block_end_string = '%}}'

db = MongoKit(app)
redis = Redis(**app.config['REDIS'])

mailer = AmazonMailer(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

login_manager = LoginManager()
login_manager.init_app(app)

# fast Markdown parser
Misaka(app)

from afm import views

