from flask.ext.assets import Bundle, Environment

assets = Environment()
assets.register('scripts', Bundle(
    'js/angular.js',
    'js/comet.js',
    'js/angular-cookies.js',
    'js/angular-resource.js',
    'js/swfobject.js',
    'js/app/radio.js',
    filters='uglifyjs', output='js/deploy/app.%(version)s.js'))