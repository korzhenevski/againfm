/**
 * Представление флеш-плеера.
 *
 * Загрузка из swfobject -> ожидание callback от флеша.
 * События:
 *   ready - плеер загружен, externalInterface доступен
 *   loading - поток начал загружаться
 *   playing - поток играет
 *   stopped - поток остановлен
 *   exception - произошла ошибка в плеере или загрузчике
 *
 * @type {function}
 */
App.FlashPlayerEngine = App.View.extend({
    el: '#flash-player',
    ready: false,

    initialize: function(options) {
        // метод вызываемый из флеша, обертка для trigger
        window['flashPlayerCallback'] = _.bind(this.trigger, this);

        // грузим плеер в контейнер, размеры берем из css, минимальная версия - 10
        // контейнер нужен, для разлокировки от всяких ClickToFlash
        var callback = _.bind(this._swfobjectCallback, this);
        swfobject.embedSWF(options.url, this.el.id, this.$el.width(), this.$el.height(), '10', false, {}, {
            "allowScriptAccess": "always",
            'wmode': 'transparent'
        }, {}, callback);

        // событие ready - флеш загрузился и готов к работе
        this.on('ready', function(){
            this.ready = true;
            this.$el.css('visibility', 'hidden');
        });

        // к функциям флеша нельзя применять apply, поэтому проксируем обертки
        // с проверкой готовности флеша
        var self = this;
        _.each(['play', 'stop', 'setVolume', 'getVolume', 'mute', 'unmute'], function(name){
            var fn = self[name];
            self[name] = function() {
                if (this.ready) {
                    fn.apply(this, arguments);
                } else {
                    this.trigger('exception', 'player not ready');
                }
            }
        })
    },

    _swfobjectCallback: function(res) {
        if (res.success) {
            this.setElement(res.ref);
        } else {
            this.trigger('exception', 'swfobject load unsuccess');
        }
    },

    checkReady: function() {
        if (!this.ready) {
        }
    },

    play: function(url) {
        this.el.playStream(url);
    },

    stop: function(fade) {
        this.el[fade ? 'stopStreamWithFade' : 'stopStream']();
    },

    setVolume: function(volume) {
        this.el.setVolume(volume);
    },

    getVolume: function() {
        return this.el.getVolume();
    },

    mute: function() {
        this.el.mute();
    },

    unmute: function() {
        this.el.unmute();
    }
});

App.Player = function() {
    this.initialize.apply(this, arguments);
}

_.extend(App.Player.prototype, {
    station: null,
    initialize: function() {
        this.engine = new App.FlashPlayerEngine({url: '/static/swf/player.swf'});
    },

    setStation: function(station) {
        this.station = station;
    }
});

$(function() {
    App.player = new App.Player();
})