/**
 * статус имеет 4 состояния
 *  загрузка
 *  трек-инфо
 *  инфа недоступна
 *  радио недоступно
 */


var App = App || {};

App.Feed = App.klass({
    params: {},
    mediator: App.mediator,

    initialize: function(options) {
        this.engine = new Comet(options.url);
        this.mediator.on('player:stopped player:error radio:error', this.stop, this);
        this.mediator.on('player:playing', this.start, this);
        this.mediator.on('radio:station_changed', function(station){
            this.params.station_id = station.id;
        }, this);

        this.mediator.on('radio:stream_changed', function(stream){
            this.params.stream_id = stream.id;
        }, this);

        this.mediator.on('user:logged user:logout', function(user){
            this.params.user_id = user ? user.id : null;
            this.stop();
            this.start();
        }, this);
    },

    changeTrack: function(track) {
        this.mediator.trigger('feed:track_changed', track);
    },

    start: function() {
        this.engine.subscribe(this.params, _.bind(this.changeTrack, this));
    },

    stop: function() {
        this.engine.unsubscribe();
    }
});

App.StickerManager = App.Model.extend({
    mediator: App.mediator,

    initialize: function() {
        this.mediator.on('radio:station_changed', this.setStation, this);
        this.mediator.on('feed:track_changed', this.setTrack, this);
        this.mediator.on('player:error radio:error', function(error){
            this.setError(error);
        }, this);

        this.on('change:station change:track', function(){
            this.set({trackUnavailable: false});
        });
    },

    setStation: function(station) {
        this.set({
            station: station,
            track: null,
            error: false
        });
    },

    setTrack: function(track) {
        this.set('track', track);
    },

    setError: function(error) {
        this.set('error', error || true);
    },

    trackUnavailable: function() {
        if (!this.get('track')) {
            this.set('trackUnavailable', true);
        }
    }
});

App.StickerView = App.View.extend({
    el: '.radio-sticker',
    template: App.getTemplate('sticker'),
    events: {
        'click .bookmark-station': 'bookmarkStation'
    },
    icon: {
        notfound: '/static/i/display/notfound.png',
        loading: '/static/i/display/loading.png'
    },

    initialize: function() {
        this.model = new App.StickerManager();
        this.model.on('change', this.render, this);

        // если в течение 20-ти секунд нет трек-инфы, меняем статус на "информация недоступна"
        this.model.on('change:station', function(){
            // останавливаем таймер
            if (this.infoTimer) {
                clearTimeout(this.infoTimer);
            }
            this.infoTimer = setTimeout(_.bind(this.model.trackUnavailable, this.model), 10000);
        }, this);

        // останавливаем таймер при ошибке
        this.model.on('change:error', function(model, value){
            if (this.infoTimer && value) {
                clearTimeout(this.infoTimer);
            }
        }, this);
    },

    render: function() {
        var context = {};
        var attrs = this.model.toJSON();
        if (!attrs.station) {
            return;
        }
        context.station = attrs.station;
        context.image_url = this.icon.notfound;
        if (attrs.error) {
            context.title = App.i18n('radio.errors.radio_unavailable');
        } else if (attrs.trackUnavailable) {
            context.title = App.i18n('radio.errors.info_unavailable');
        } else if (attrs.track) {
            var track = attrs.track;
            if (track.artist && track.name) {
                context.title = track.name;
                context.subtitle = track.artist;
            } else if (track.title) {
                context.title = track.title;
            } else {
                context.title = App.i18n('radio.loading');
                context.image_url = this.icon.loading;
            }
            if (track.image_url) {
                context.image_url = track.image_url;
            }
        } else {
            context.title = App.i18n('radio.loading');
            context.image_url = this.icon.loading;
        }

        this.$el.show().html(this.template(context));
        this.marqueeTitle();
    },

    /**
     * Добавление или удаление станции в избранное.
     */
    bookmarkStation: function() {
        this.model.bookmarkStation();
    },

    /**
     * Бегущая строка.
     */
    marqueeTitle: function() {
        var $title = this.$('.title-inner'),
            overhead = $title.width() - $title.parent().width();
        // если заголовок перекрывает контейнер, включаем анимацию
        if (overhead < 10) {
            return;
        }
        $title.stop();
        var marquee = function(overhead, delay) {
            var duration = Math.abs(overhead) * 35;
            $title.delay(delay).animate({
                'margin-left': overhead < 0 ? 0 : -1 * overhead
            }, duration, 'linear', function() {
                // анимация в обратную сторону, задержка 3 секунды
                marquee(-overhead, 3000);
            });
        };
        // задержка перед анимацией 4 секунды
        marquee(overhead, 4000);
    }
});

$(function(){
    App.feed = new App.Feed({url: 'http://comet.againfm.local/'});
    App.sticker = new App.StickerView();
});