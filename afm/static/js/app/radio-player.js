/**
 * Контролер плеера
 */
App.Player = function() {
    this.initialize.apply(this, arguments);
};

_.extend(App.Player.prototype, Backbone.Events, {
    station: null,
    mediator: App.mediator,
    initialize: function() {
        this.engine = new App.FlashPlayerEngine({url: '/static/swf/player.swf'});
        this.mediator.on('playlist:station_changed', this.setStation, this);

        this.engine.publishEvents('playing stopped exception', this.mediator, 'player');
        this.publishEvents('loading exception', this.mediator, 'player');
    },

    setStation: function(station) {
        this.station = station;
        this.engine.stop();
        this.trigger('loading');

        var url = '/api/station/' + station.id + '/getplayinfo';
        var cb = _.bind(this.setPlayInfo, this);
        $.getJSON(url, cb).error(_.bind(function(state, err){
            this.trigger('exception', 'getplayinfo error: '+err);
        }, this));
    },

    setPlayInfo: function(playinfo) {
        this.playinfo = playinfo;
        this.engine.play(this.playinfo.stream.url);
    }
});

/**
 * Представление флеш-плеера.
 *
 * Загрузка из swfobject -> ожидание callback от флеша.
 * События:
 *   ready - плеер загружен, externalInterface доступен
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
            self[name] = _.bind(function() {
                if (this.ready) {
                    fn.apply(this, arguments);
                } else {
                    this.trigger('exception', 'player not ready');
                }
            }, self);
        })
    },

    _swfobjectCallback: function(res) {
        if (res.success) {
            this.setElement(res.ref);
        } else {
            this.trigger('exception', 'swfobject load unsuccess');
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

App.PlayerControls = App.View.extend({

});

$(function() {
    App.player = new App.Player();
});

/**
 * статус имеет 4 состояния
 *  загрузка
 *  трек-инфо
 *  инфа недоступна
 *  радио недоступно
 */