from flask.ext.assets import Bundle, Environment

assets = Environment()
assets.register('common', Bundle(
    'js/angular.js',
    'js/comet.js',
    'js/angular-cookies.js',
    'js/angular-resource.js',
    'js/swfobject.js',
    filters='uglifyjs', output='js/deploy/common-%(version)s.js'))

assets.register('styles', Bundle(
    'css/normalize.css',
    'css/style.css', output='css/deploy/style.%(version)s.css'))