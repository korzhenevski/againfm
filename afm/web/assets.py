from flask.ext.assets import Bundle, Environment
from afm import app

assets = Environment()
libs = [
    'jquery.min.js',
    'jquery-ui-1.8.23.custom.min.js',
    # jquery-ui touch events support
    'jquery.ui.touch-punch.js',
    'lodash.underscore.min.js',
    'backbone.js',
    # radio-display
    'jquery.tinyscrollbar.js',
    'jquery.textchange.js',
    #'js/libs/jquery.transition.js',
    'bootstrap-button.js',
    # radio-player
    'swfobject.js',
    'modernizr.js',
    'jquery.watermark.js',
    'jquery.cookie.js',
    'comet.js'
]
libs += ['handlebars.js'] if app.debug else ['handlebars.runtime.js', 'render.js']
libs = ['js/libs/' + lib for lib in libs]

assets.register('core_scripts', Bundle(*libs, filters='uglifyjs', output='js/deploy/core.%(version)s.js'))

assets.register('scripts', Bundle(
    'js/app/app.js',
    'js/app/radio-display.js',
    'js/app/radio-spectrum.js',
    'js/app/radio-player.js',
    'js/app/radio-sticker.js',
    'js/app/form-validator.js',
    'js/app/user-pages.js',
    'js/app/user-topbox.js',
    'js/app/site-pages.js',
    'js/app/user.js',
    'js/app/router.js',
    filters='uglifyjs', output='js/deploy/app.%(version)s.js'))