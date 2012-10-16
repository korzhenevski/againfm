var App = App || {};

/**
 * Comet-посредник,
 * обновляет текущий трек радиостанции.
 *
 * @type {function}
 */
App.Feed = App.klass({
    mediator: App.mediator,

    initialize: function(options) {
        this.params = {};
        this.engine = new Comet(options.url);

        this.mediator.on('player:stopped player:error radio:error', this.stop, this);
        this.mediator.on('player:playing', this.start, this);

        this.mediator.on('radio:station_changed', function(station){
            this.params.station_id = station.id;
        }, this);

        this.mediator.on('radio:stream_changed', function(stream){
            this.params.stream_id = stream.id;
        }, this);

        // рестартуем клиента при смене пользовательского состояния
        this.mediator.on('user:logged user:logout', function(user){
            this.params.user_id = user ? user.id : null;
            this.stop();
            this.start();
        }, this);
    },

    changeTrack: function(track) {
        this.mediator.trigger('feed:track_changed', track);
    },

    // обязательные параметры для comet запроса
    _checkParams: function() {
        return _.has(this.params, 'station_id') && _.has(this.params, 'stream_id');
    },

    start: function() {
        if (!this._checkParams()) return;
        this.engine.subscribe(this.params, _.bind(this.changeTrack, this));
    },

    stop: function() {
        if (!this._checkParams()) return;
        this.engine.unsubscribe();
    }
});

/**
 * Посредник мини-дисплея.
 *
 * @type {function}
 */
App.Sticker = App.Model.extend({
    mediator: App.mediator,
    stationBookmarkUrl: '/api/user/favorite/station/',

    initialize: function() {
        this.mediator.on('radio:station_changed', this.setStation, this);
        this.mediator.on('feed:track_changed', this.setTrack, this);
        this.mediator.on('player:error radio:error', function(error){
            this.setError(error);
        }, this);

        this.on('change:station change:track', function(){
            this.set({trackUnavailable: false});
        });
        // следим за обновлением
        this.mediator.on('user_favorites:change', function(track_id, favorite){
            var track = this.get('track');
            if (track && track.id == track_id) {
                track.favorite = favorite;
                this.update('track', track);
            }
        }, this);
        // добавление станции в закладки
        // при выходе юзера отключаем
        this.mediator.on('user:logout', function(){
            var station = this.get('station');
            if (station) {
                delete station.favorite;
                this.update('station', station);
            }
        }, this);
        // при входе включаем
        this.mediator.on('user:logged', function(){
            var station = this.get('station');
            if (!station || _.has(station, 'favorite')) {
                return;
            }
            // получаем статус
            $.getJSON(this.stationBookmarkUrl + station.id, _.bind(function(response){
                this.update('station', $.extend(station, response));
            }, this));
        }, this);
        this.publishEvents('bookmark_station bookmark_track', this.mediator, 'sticker');
    },

    bookmarkStation: function() {
        var station = this.get('station');
        if (!station) {
            return;
        }
        station.favorite = !station.favorite;
        this.update('station', station);
        $.post(this.stationBookmarkUrl + station.id);
        this.trigger('bookmark_station', station.id, station.favorite);
    },

    bookmarkTrack: function() {
        var track = this.get('track');
        if (!track) {
            return;
        }
        track.favorite = !track.favorite;
        this.update('track', track);
        $.post('/api/user/favorite/track/' + track.id);
        this.trigger('bookmark_track', track.id, track.favorite);
    },

    // метод для изменения части данных,
    // вне модели, другое событие
    update: function(field, value) {
        this.set(field, value, {silent: true});
        this.trigger('update');
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
        var track = this.get('track');
        if (!track || _.isEmpty(track)) {
            this.set('trackUnavailable', true);
        }
    }
});

/**
 * Представление мини-дисплея.
 *
 * @type {function}
 */
App.StickerView = App.View.extend({
    el: '.radio-sticker',
    template: App.getTemplate('sticker'),
    events: {
        'click .bookmark-station': 'bookmarkStation',
        'click .bookmark-track': 'bookmarkTrack'
    },
    icon: {
        notfound: '/static/i/display/notfound.png',
        loading: '/static/i/display/loading.png'
    },

    initialize: function() {
        this.model = new App.Sticker();
        this.model.on('change update', this.render, this);

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
        context.has_station_favorite = _.has(attrs.station, 'favorite');
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
            // звездочка - добавление трека в избранное
            context.has_track_favorite = _.has(track, 'favorite');
            if (context.has_track_favorite) {
                context.favorite_track = track.favorite;
            }
            // обложка
            if (track.image_url) {
                context.image_url = track.image_url;
            }
        } else {
            context.title = App.i18n('radio.loading');
            context.image_url = this.icon.loading;
        }

        /*var html = this.template(context);
        var self = this;
        this.$el.fadeOut(300, 'linear', function(){
            self.$el.html(html).fadeIn(500, 'linear', function(){
                self.marqueeTitle();
            });
        });*/
        // TODO: добавить анимацию для смены состояний закладок
        this.$el.show().html(this.template(context));
        this.marqueeTitle();
    },

    /**
     * Добавление или удаление станции в избранное.
     */
    bookmarkStation: function() {
        this.model.bookmarkStation();
    },

    bookmarkTrack: function() {
        this.model.bookmarkTrack();
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