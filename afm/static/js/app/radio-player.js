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
 * Контролер плеера
 */
App.Player = App.Model.extend({
    mediator: App.mediator,
    defaults: {
        volume: 40
    },

    initialize: function() {
        this.engine = new App.FlashPlayerEngine({url: '/static/swf/player.swf'});
        // подписываемся на смену станции
        this.mediator.on('playlist:station_changed', this.setStation, this);
        // публикуем в медиатор локальные события
        this.engine.publishEvents('playing stopped error', this.mediator, 'player');
        this.publishEvents('loading error', this.mediator, 'player');
        // устанавливаем громкость
        if ($.cookie('volume')) {
            this.set('volume', parseInt($.cookie('volume')));
        }
        this.engine.on('ready', this.syncVolume, this);
        this.on('change:volume', this.syncVolume, this);
        // смена громкости по глобальному событию
        this.mediator.on('player:set_volume', function(volume){
            this.set('volume', parseInt(volume));
        }, this);
    },

    setStation: function(station) {
        this.station = station;
        // останавливаем плеер до загрузки адреса потока
        this.engine.stop();
        this.trigger('loading');
        // запрос адреса потока
        var url = '/api/station/' + station.id + '/getplayinfo';
        var cb = _.bind(this.setPlayInfo, this);
        $.getJSON(url, cb).error(_.bind(function(state, err){
            // если ajax-ошибка, кидаем событие error
            this.trigger('error', 'getplayinfo error: '+err);
        }, this));
    },

    setPlayInfo: function(playinfo) {
        this.set('playinfo', playinfo);
        this.play();
    },

    toggle: function() {
        // если стация не выбрана, хорошо играть самую первую
        // кидаем событие - дислей поймает
        // TODO: возможно это хуйня и надо перепроектировать
        if (!this.get('playinfo')) {
            this.mediator.trigger('player:power');
            return;
        }

        if (this.engine.isPlaying()) {
            this.engine.stop();
        } else {
            this.play();
        }
    },

    play: function() {
        this.engine.play(this.get('playinfo').url);
    },

    syncVolume: function() {
        $.cookie('volume', this.get('volume'));
        this.engine.setVolume(this.get('volume') / 100);
    }
});

/**
 * Представление громкости.
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
        this.player.on('change:volume', this.render, this);
        // бегунок
        var self = this;
        this.$sound = this.$('.sound');
        this.$slider = this.$('.slider').slider({
            range: 'min',
            value: this.player.get('volume'),
            slide:_.bind(this.changeSlider, this)
        });
    },

    changeSlider: function(evnt, ui) {
        this.player.set('volume', ui.value);
    },

    render: function() {
        var volume = this.player.get('volume');
        this.$slider.slider('value', volume);
        this.$sound.toggleClass('sound-off', volume === 0).show();
    },

    controlSound: function() {
        // если громкость уже нулевая, отключение пропускаем
        if (!this.muted && !this.player.get('volume')) {
            return;
        }

        if (this.muted) {
            this.player.set('volume', this.mutedVolume);
        } else {
            this.mutedVolume = this.player.get('volume');
            this.player.set('volume', 0);
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

    initialize: function(options) {
        this.player = options.player;
        this.player.on('change:playinfo', this.render, this);
        // add global volume tracking
        this.volume = new App.PlayerVolumeView({player: this.player});
        this.volume.render();
    },

    render: function() {
        // индикатор высокого битрейта
        var playinfo = this.player.get('playinfo');
        this.$('.hd').toggle(playinfo && playinfo['bitrate'] >= 192);
    },

    toggle: function() {
        this.player.toggle();
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
    App.playerView = new App.PlayerView({player: player});
});

/**
 * статус имеет 4 состояния
 *  загрузка
 *  трек-инфо
 *  инфа недоступна
 *  радио недоступно
 */