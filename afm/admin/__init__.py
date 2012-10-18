#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import Flask
from flask.ext.mongokit import MongoKit
from afm.admin import views

app = Flask(__name__)
app.config.from_pyfile('config.py')

db = MongoKit(app)

