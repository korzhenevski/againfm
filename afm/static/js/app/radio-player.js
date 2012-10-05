/**
 * Представление флеш-плеера.
 *
 * Загрузка из swfobject -> ожидание callback от флеша.
 * События:
 *   ready - плеер загружен, externalInterface доступен
 *   playing - поток играет
 *   stopped - поток остановлен
 *   error - произошла ошибка в плеере или загрузчике
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
        _.each(['play', 'stop', 'setVolume', 'isPlaying'], function(name){
            var fn = self[name];
            self[name] = _.bind(function() {
                if (this.ready) {
                    return fn.apply(this, arguments);
                } else {
                    this.trigger('error', 'player not ready');
                }
            }, self);
        })
    },

    _swfobjectCallback: function(res) {
        if (res.success) {
            this.setElement(res.ref);
        } else {
            this.trigger('error', 'swfobject load unsuccess');
        }
    },

    play: function(url) {
        this.el.playStream(url);
    },

    stop: function() {
        this.el.stopStream();
    },

    setVolume: function(volume) {
        this.el.setVolume(volume);
    },

    isPlaying: function() {
        return this.el.isPlaying();
    }
});

/**
 */

/**
 * Контролер плеера
 *
 * @type {function}
 */
App.Player = App.Model.extend({
    mediator: App.mediator,
    volume: 40,
    station: {},

    initialize: function() {
        this.engine = new App.FlashPlayerEngine({url: '/static/swf/player.swf'});
        // подписываемся на смену станции
        this.mediator.on('radio:station_changed', this.stationChanged, this);
        this.mediator.on('radio:stream_changed', this.playStream, this);
        // смена громкости по глобальному событию
        this.mediator.on('player:set_volume', function(volume){
            this.setVolume(parseInt(volume));
        }, this);
        // публикуем в медиатор локальные события
        this.engine.publishEvents('playing stopped error', this.mediator, 'player');
        this.publishEvents('error', this.mediator, 'player');
        // устанавливаем громкость
        if ($.cookie('volume')) {
            this.setVolume(parseInt($.cookie('volume')));
        }
        this.on('volume_changed', this.syncVolume, this);
        this.engine.on('ready', this.syncVolume, this);
    },

    stationChanged: function(station) {
        // игнорируем апдейты станции
        if (this.station['id'] == station['id']) {
            return;
        }
        this.station = station;
        // останавливаем плеер до загрузки адреса потока
        this.engine.stop();
    },

    play: function() {
        this.engine.play(this.stream.url);
    },

    playStream: function(stream) {
        this.stream = stream;
        this.play();
    },

    setVolume: function(volume) {
        this.volume = volume;
        this.trigger('volume_changed');
    },

    toggle: function() {
        // если стация не выбрана, хорошо играть самую первую
        // кидаем событие - дислей поймает
        // TODO: возможно это хуйня и надо перепроектировать
        if (!this.stream) {
            this.mediator.trigger('player:power');
            return;
        }

        if (this.engine.isPlaying()) {
            this.engine.stop();
        } else {
            this.play();
        }
    },

    syncVolume: function() {
        $.cookie('volume', this.volume);
        this.engine.setVolume(this.volume / 100);
    }
});

/**
 * Представление регулятора громкости.
 *
 * @type {function}
 */
App.PlayerVolumeView = App.View.extend({
    el: '.radio-controls-status',
    muted: false,
    mutedVolume: 0,
    events: {
        'click .sound': 'controlSound'
    },

    initialize: function(options) {
        this.player = options.player;
        this.player.on('volume_changed', this.render, this);
        // бегунок
        var self = this;
        this.$sound = this.$('.sound');
        this.$slider = this.$('.slider').slider({
            range: 'min',
            value: this.player.volume,
            slide:_.bind(this.changeSlider, this)
        });
    },

    changeSlider: function(evnt, ui) {
        this.player.setVolume(ui.value);
    },

    render: function() {
        var volume = this.player.volume;
        this.$slider.slider('value', volume);
        this.$sound.toggleClass('sound-off', volume === 0).show();
    },

    controlSound: function() {
        // если громкость уже нулевая, отключение пропускаем
        if (!this.muted && !this.player.volume) {
            return;
        }

        if (this.muted) {
            this.player.setVolume(this.mutedVolume);
        } else {
            this.mutedVolume = this.player.volume;
            this.player.setVolume(0);
        }

        this.muted = !this.muted;
    }
});

/**
 * Представление элементов управления плеера.
 *
 * @type {function}
 */
App.PlayerView = App.View.extend({
    el: '.radio-controls',
    events: {
        'click .power': 'toggle'
    },
    mediator: App.mediator,

    initialize: function(options) {
        this.player = options.player;
        this.mediator.on('radio:stream_changed', this.streamChanged, this);
        // add global volume tracking
        this.volume = new App.PlayerVolumeView({player: this.player});
        this.volume.render();
    },

    streamChanged: function(stream) {
        // индикатор высокого битрейта
        this.$('.hd').toggle(stream['bitrate'] >= 192);
    },

    toggle: function() {
        this.player.toggle();
    }
});

/**
 * Менеджер загрузки радио.
 *
 * @type {function}
 */
App.Radio = App.Model.extend({
    mediator: App.mediator,
    defaults: {
        station: {},
        stream: {}
    },

    initialize: function() {
        this.publishEvents('station_changed stream_changed error', this.mediator, 'radio');
        this.mediator.on('playlist:station_changed', this.playlistStationChanged, this);
    },

    playlistStationChanged: function(station) {
        // модель приводим к плоскому виду
        this.setStation(station.toJSON());
        // запрос адреса потока
        var url = '/api/station/' + station.id + '/getplayinfo';
        var cb = _.bind(function(playinfo){
            this.setStation(_.extend(this.station, playinfo['station']));
            this.setStream(playinfo['stream'])
        }, this);
        $.getJSON(url, cb).error(_.bind(function(state, err){
            // если ajax-ошибка, кидаем событие error
            this.trigger('error', 'getplayinfo error: '+err);
        }, this));
    },

    setStation: function(station) {
        this.station = station;
        this.trigger('station_changed', station);
    },

    setStream: function(stream) {
        this.stream = stream;
        this.trigger('stream_changed', stream);
    }
});

/**
 * Player (model)
 *  - PlayerEngine
 *
 * PlayerView
 *  - PlayerVolumeView
 *
 */
$(function() {
    var player = new App.Player();
    App.radio = new App.Radio();
    App.playerView = new App.PlayerView({player: player});
});
