from flask.ext.assets import Bundle, Environment

assets = Environment()
assets.register('core_scripts', Bundle(
    'js/libs/jquery.min.js',
    'js/libs/jquery-ui-1.8.23.custom.min.js',
    # jquery-ui touch events support
    'js/libs/jquery.ui.touch-punch.js',
    'js/libs/lodash.underscore.min.js',
    'js/libs/backbone.js',
    # radio-display
    'js/libs/jquery.tinyscrollbar.js',
    'js/libs/jquery.textchange.js',
    #'js/libs/jquery.transition.js',
    'js/libs/bootstrap-button.js',
    # radio-player
    'js/libs/swfobject.js',
    # for production with precompiled templates only include tiny handlerbars.runtime.js
    #'js/handlebars.runtime.js',
    #'js/render.js',
    'js/libs/handlebars.js',
    'js/libs/jquery.watermark.js',
    'js/libs/jquery.cookie.js',
    'js/libs/comet.js',
    filters='uglifyjs', output='js/deploy/core.%(version)s.js'))

assets.register('scripts', Bundle(
    'js/app/app.js',
    'js/app/radio-display.js',
    'js/app/radio-player.js',
    'js/app/radio-sticker.js',
    #'js/app/radio-spectrum.js',
    'js/app/form-validator.js',
    'js/app/user-pages.js',
    'js/app/user-topbox.js',
    'js/app/user.js',
    'js/app/site-pages.js',
    'js/app/router.js',
    filters='uglifyjs', output='js/deploy/app.%(version)s.js'))