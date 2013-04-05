#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.assets import Bundle, Environment

scripts = ['angular', 'comet', 'angular-cookies', 'angular-resource', 'swfobject']
scripts = ['js/common/{}.js'.format(script) for script in scripts]

assets = Environment()
assets.register('common', Bundle(*scripts, filters='uglifyjs', output='js/deploy/common-%(version)s.js'))
assets.register('styles', Bundle('css/normalize.css', 'css/style.css', output='css/deploy/style.%(version)s.css'))