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
        this.engine.on('ready', this.syncEngineVolume, this);
        this.on('change:volume', this.syncEngineVolume, this);
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
        this.playinfo = playinfo;
        this.play();
    },

    toggle: function() {
        // если стация не выбрана, хорошо играть самую первую
        // кидаем событие - дислей поймает
        // TODO: возможно это хуйня и надо перепроектировать
        if (!this.playinfo) {
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
        this.engine.play(this.playinfo.stream.url);
    },

    syncEngineVolume: function() {
        this.engine.setVolume(this.get('volume') / 100);
    }
});

/**
 * Представление громкости.
 *
 * Создает событие volume_changed.
 *
 * @type {function}
 */
App.PlayerVolumeView = App.View.extend({
    el: '.radio-controls-status',
    events: {
        'click .sound': 'controlSound'
    },

    initialize: function(options) {
        this.volume = options.volume;
        this.muted = false;
        this.mutedVolume = 0;
        this.render();
    },

    render: function() {
        // бегунок
        var self = this;
        this.$sound = this.$('.sound');
        this.$slider = this.$('.slider').slider({
            range: 'min',
            value: this.volume,
            slide: function(evnt, ui) {
                self.setVolume(ui.value);
            }
        });
        // начальное состояние индикатора звука
        this.$sound.toggleClass('sound-off', this.volume === 0).show();
    },

    setVolume: function(volume) {
        this.volume = volume;
        this.$slider.slider('value', this.volume);
        this.$sound.toggleClass('sound-off', this.volume === 0).show();
        this.trigger('volume_changed', this.volume);
    },

    controlSound: function() {
        // если громкость уже нулевая, отключение пропускаем
        if (!this.muted && !this.volume) {
            return;
        }

        if (this.muted) {
            this.setVolume(this.mutedVolume);
        } else {
            this.mutedVolume = this.volume;
            this.setVolume(0);
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
        // add global volume tracking
        this.volume = new App.PlayerVolumeView({volume: this.player.get('volume')});
        this.volume.on('volume_changed', function(volume){
            this.player.set('volume', volume);
        }, this);
        this.render();
    },

    render: function() {
        this.volume.render();
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
    var player = new App.Player({volume: 30});
    App.playerView = new App.PlayerView({player: player});
});

/**
 * статус имеет 4 состояния
 *  загрузка
 *  трек-инфо
 *  инфа недоступна
 *  радио недоступно
 */