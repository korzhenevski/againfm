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
        window.flashPlayerCallback = _.bind(this.trigger, this);

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
        });
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
App.Player = App.klass({
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
            this.setVolume(parseInt(volume, 10));
        }, this);
        this.engine.on('ready', this.engineReady, this);
        // публикуем в медиатор локальные события
        this.engine.publishEvents('ready playing stopped error', this.mediator, 'player');
        this.publishEvents('error', this.mediator, 'player');
        // если радио играет, при выгрузке страницы флеш кидает ошибку
        // поэтому останавливаем поток до выгрузки
        // TODO: важно понять, кто за это отвечает :)
        this.mediator.on('app:unload', function(){
            if (this.engine.ready) {
                this.engine.stop();
            }
        }, this);
        // громкость из cookie
        this.volume = $.cookie('volume') ? parseInt($.cookie('volume')) : this.volume;
    },

    engineReady: function() {
        this.on('volume_changed', function(){
            this.engine.setVolume(this.volume / 100);
        }, this);
        this.engine.setVolume(this.volume / 100);
        // если к моменту загрузки плеера есть станция и поток,
        // включаем плеер
        if (this.station && this.stream) {
            this.play();
        }
    },

    stationChanged: function(station) {
        // игнорируем апдейты станции
        if (this.station.id == station.id) {
            return;
        }
        this.station = station;
        this.stream = null;
        // останавливаем плеер до загрузки адреса потока
        if (this.engine.ready) {
            this.engine.stop();
        }
    },

    isPlaying: function() {
        return this.engine.isPlaying();
    },

    play: function() {
        if (this.engine.ready) {
            this.engine.play(this.stream.url);
        }
    },

    playStream: function(stream) {
        this.stream = stream;
        this.play();
    },

    setVolume: function(volume) {
        this.volume = volume;
        this.trigger('volume_changed');
        $.cookie('volume', volume);
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
        this.$('.hd').toggle(stream.bitrate >= 192);
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

    initialize: function() {
        this.publishEvents('station_changed stream_changed error', this.mediator, 'radio');
        this.mediator.on('playlist:station_changed route:station', this.changeStation, this);
    },

    changeStation: function(station) {
        // модель приводим к плоскому виду
        if (station instanceof App.Station) {
            station = station.toJSON();
        }
        // пропускаем повторные вызовы
        if (this.station && station.id == this.station.id) {
            return;
        }
        this.setStation(station);
        // запрос адреса потока
        var url = '/api/station/' + station.id + '/getplayinfo';
        var callback = _.bind(function(playinfo){
            this.setStation($.extend(this.station, playinfo.station));
            this.setStream(playinfo.stream);
        }, this);
        $.getJSON(url, callback).error(_.bind(function(state, err){
            // если ajax-ошибка, кидаем событие error
            this.trigger('error', 'getplayinfo error: '+err);
        }, this));
    },

    setStation: function(station) {
        this.station = station;
        this.trigger('station_changed', _.clone(station));
    },

    setStream: function(stream) {
        this.stream = stream;
        this.trigger('stream_changed', _.clone(stream));
    }
});

/**
 * Меняем фавиконку если радио играет.
 *
 * @type {function}
 */
App.PlayerFaviconView = App.klass({
    id: 'favicon',
    mediator: App.mediator,

    initialize: function() {
        this.mediator.on('player:playing', function() {
            this.setIcon('favicon_play');
        }, this);

        this.mediator.on('player:stopped', function() {
            this.setIcon('favicon');
        }, this);
    },

    setIcon: function(name) {
        var icon = $('<link>').attr({
            id: this.id,
            rel: 'shortcut icon',
            type: 'image/ico',
            href: '/static/i/' + name + '.ico'
        });
        $('#' + this.id).replaceWith($(icon));
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
    new App.PlayerFaviconView();
    App.radio = new App.Radio();
    App.playerView = new App.PlayerView({player: player});
});
