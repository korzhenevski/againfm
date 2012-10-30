#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import Flask
from celery import Celery
from flask.ext.login import LoginManager
from flask.ext.mongokit import MongoKit
from redis import Redis
from .i18n import I18n
from .mailer import AmazonMailer


"""
playfm развернуть!

еще какую нибуй хуйню для мониторинга - через scoutapp
- отосланные письма
- монга
- редис
- кол-во клиентов в cometfm - это еще можно и в redis писать, потом графики порисуем
- кол-во online/offline потоков

интерфейс:
- ползунок, spectrum, смена пароля, смена display name, иконка входа через vkontakte
- недоступные станции отмечать серым - лучше даже сортировать и в конец плейлиста их
- ограничение высоты favorites

"""

app = Flask(__name__)
app.config.from_pyfile('config.py')
app.config.from_pyfile('local_config.py', silent=True)

i18n = I18n(app)
db = MongoKit(app)
redis = Redis(**app.config['REDIS'])

mailer = AmazonMailer(app)

celery = Celery(__name__)
celery.conf.add_defaults(app.config)

login_manager = LoginManager()
login_manager.init_app(app)

from afm.web import web
from afm.admin import admin

app.register_blueprint(web)
app.register_blueprint(admin, url_prefix='/admin')

from afm.web.assets import assets
assets.init_app(app)

if not app.config['DEBUG']:
    from raven.contrib.flask import Sentry
    sentry = Sentry(app)