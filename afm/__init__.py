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

if app.debug:
    # show immediately template changes during debug
    app.jinja_env.cache.clear()
else:
    import logging
    from logging.handlers import RotatingFileHandler
    logger = RotatingFileHandler(app.config['ERROR_LOG'], maxBytes=1024*1024*10, backupCount=20)
    logger.setLevel(logging.ERROR)
    logger.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    app.logger.addHandler(logger)

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

