var App = App || {};

/**
 * Плейлист (список радио).
 *
 * Выборка по селектору и управление курсором текущего радио.
 *
 * @type {function}
 */
App.Playlist = App.Collection.extend({
    model: App.Station,
    _state: {},
    _selector: 'default',
    _shuffled: [],

    initialize: function() {
        // track station for restore playlist current
        this.on('station_changed', function(station){
            this._state = {};
            this._state[this._selector] = {currentStation: station};
        });
    },

    url: function() {
        return '/api/playlist/' + this._selector;
    },

    setStation: function(station) {
        this.currentStation = station;
        this.trigger('station_changed', station);
    },

    getStation: function() {
        return this.currentStation;
    },

    next: function() {
        var index = this.indexOf(this.getStation());
        if (index < 0 || ++index >= this.length) {
            index = 0;
        }
        this.setStation(this.at(index));
    },

    previous: function() {
        var index = this.indexOf(this.getStation());
        if (index < 0 || --index < 0) {
            index = this.length - 1;
        }
        this.setStation(this.at(index));
    },

    fetch: function() {
        var self = this;
        return $.getJSON(this.url(), function(response){
            if (response && response.objects) {
                //var objects = _.map(response.objects, function(title, id){
                //   return {id: id, title: title};
                //});
                self.reset(response.objects);
            }
        });
    },

    /**
     * Загрузка по селектору.
     * @param selector string
     */
    fetchBySelector: function(selector, options) {
        options = _.defaults(options || {}, {shuffle: false, cursor: true});
        var result = $.Deferred();
        // NB: пропускаем повторные выборки
        if (selector == this._selector) {
            result.resolve();
            return result.promise();
        }
        this._selector = selector;
        this.currentStation = null;
        var result = this.fetch();
        if (options.cursor) {
            result.done(_.bind(this.restoreSelectedStation, this));
        }
        return result;
    },

    refresh: function() {
        var self = this;
        this.fetch().always(function(){
            self.restoreSelectedStation();
        });
    },

    restoreSelectedStation: function() {
        var snapshot = this._state[this._selector];
        if (snapshot) {
            this.setStation(this.get(snapshot.currentStation.id));
        }
    },

    isEmptyFavorites: function() {
        return this._selector == 'favorite' && !this.length;
    },

    isSelected: function() {
        return !!this.currentStation;
    }
});

App.Selectors = App.Collection.extend({
    model: App.Selector,
    currentSelector: null,
    mediator: App.mediator,

    initialize: function() {
        this.mediator.on('user:logout', function(){
            this.swapIfNotActive('favorite', 'featured');
        }, this);

        this.mediator.on('user:logged', function(){
            this.swapIfNotActive('featured', 'favorite');
        }, this);
    },

    // переключаем селектор, если нет выбранного радио на плейлисте
    swapIfNotActive: function(from, to) {
        if (this.playlist.isSelected()) {
            return;
        }
        if (this.get(from).isActive()) {
            this.get(to).select();
        }
    },

    unselectAll: function() {
        return _.invoke(this.where({'active': true}), 'unselect');
    },

    select: function(model) {
        this.unselectAll();
        this.trigger('select', model.id);
        this.currentSelector = model.id;
    }
});

/**
 * Селектор
 *
 * @type {function}
 */
App.Selector = App.Model.extend({
    idAttribute: 'selector',

    defaults: {
        title: '',
        visible: true,
        active: false
    },

    show: function() {
        this.set('visible', true);
    },

    hide: function() {
        this.set('visible', false);
    },

    select: function() {
        this.collection.select(this);
        this.collection.playlist.fetchBySelector(this.id);
        this.set('active', true);
    },

    unselect: function() {
        this.set('active', false);
    },

    fetchPlaylist: function(playlist) {
        playlist.fetchBySelector(this.id, {shuffle: true});
    },

    isActive: function() {
        return this.get('active');
    }
});

App.SelectorView = App.View.extend({
    template: App.getTemplate('display_selector'),
    events: {
        'click': 'select'
    },

    render: function() {
        var context = this.model.toJSON();
        // первая часть пути селектора это класс запроса
        // tag/trance => tag
        context['class'] = context.selector.split('/')[0];
        this.setElement(this.template(context));
        return this.el;
    },

    select: function() {
        // выбирается только один раз
        if (!this.model.get('active')) {
            this.model.select();
        }
    }
});

// по умолчанию выбирается избранное или подборка
// если юзер выбрал плейлист, а потом изменил состояние
// то

App.FavoriteSelector = App.Selector.extend({
    mediator: App.mediator,

    initialize: function() {
        this.set('visible', false);
        this.set('selector', 'favorite');
        this.mediator.on('user:logged', function(){
            this.show();
        }, this);
        this.mediator.on('user:logout', function(){
            this.hide();
        }, this);
        this.mediator.on('sticker:bookmark_station', this.refreshPlaylist, this);
    },

    refreshPlaylist: function() {
        if (this.get('active')) {
            this.collection.playlist.refresh();
        }
    }
});

App.FeaturedSelector = App.Selector.extend({
    initialize: function() {
        this.set('selector', 'featured');
    }
});

App.HistorySelector = App.Selector.extend({
    initialize: function() {
        this.set('selector', 'history');
    }
});


/**
 * Панель селекторов.
 *
 * рендеринг делегирован в
 * @see SelectorView
 *
 * @type {function}
 */
App.SelectorsView = App.View.extend({
    el: '.radio-display .filters',

    initialize: function(options) {
        this.selectors = options.selectors;
        this.selectors.on('reset add change', this.render, this);
    },

    render: function() {
        var $list = this.$el.html('');
        this.selectors.each(function(model) {
            if (model.get('visible')) {
                var selector = new App.SelectorView({model: model});
                $list.append(selector.render());
            }
        });
    }
});

/**
 * Представление шкалы.
 *
 * отрисовка по обновлению плейлиста.
 * @see Playlist
 *
 * @type {function}
 */
App.DisplayView = App.View.extend({
    el: '.radio-scale .scale-inner',
    template: App.getTemplate('scale'),
    empty_favorites_template: App.getTemplate('empty_favorites_scale'),
    events: {
        'click .station': 'selectStation'
    },
    mediator: App.mediator,

    initialize: function(options) {
        this.playlist = options.playlist;
        this.playlist.on('reset', this.render, this);
        this.playlist.on('station_changed', this.stationChanged, this);
        this.setupScrollbar();
    },

    /**
     * Выделение ссылки по эвенту от плейлиста
     *
     * @param station Station
     */
    stationChanged: function(station) {
        var $link = this.links[station.id];
        // прокрутка до видимой зоны если ссылка за пределами шкалы
        // правый край
        var scrollLeft = Math.round(this.$el.position().left * -1),
            scrollShift = $link.position().left + $link.width() * 2;
        scrollShift -= scrollLeft + this.$el.parent().width();
        if (scrollShift > 0) {
            var scrollPos = scrollLeft + scrollShift;
            var maxScrollPos = this.$el.width() - this.$el.parent().width();
            if (scrollPos > maxScrollPos) {
                scrollPos = maxScrollPos;
            }
            this.updateScrollbar(scrollPos);
        }
        // левый край
        if ($link.position().left < scrollLeft) {
            this.updateScrollbar($link.position().left);
        }

        // меняем позицию бегунка, позиционирование на середину ширины ссылки
        var $cursor = this.$('.scale-slider'),
            halfWidth = Math.round(($link.width() + 13) / 2),
            cursorLeft = $link.scrollLeft() + $link.position().left + halfWidth;

        // выделяем ссылку по финишу анимации бегунка
        this.$('.active-station').removeClass('active-station');
        $cursor.show().animate({left: cursorLeft}, function(){
            $link.addClass('active-station');
        });
    },

    /**
     * Обработка клика по ссылке и обновление в плейлисте
     *
     * @param e event
     */
    selectStation: function(e) {
        var station = this.playlist.get($(e.target).data('id'));
        var currentStation = this.playlist.getStation();
        if (station && currentStation && currentStation.id == station.id) {
            return false;
        }
        this.playlist.setStation(station);
    },

    /**
     * этот код писали обкуренные черти
     * TODO: переписать без всяких spots и прочей хуйни
     */
    render: function() {
        /**
         * всесто пустого списка ибранного, показываем нормальное описание
         */
        if (this.playlist.isEmptyFavorites()) {
            this.$el.html(this.empty_favorites_template()).css('width', '100%');
            this.$el.parent().removeClass('movable');
            this.updateScrollbar();
            return;
        }

        var SLIDER_SIZE = 13,
            space = 150 - Math.round(Math.log(this.playlist.length) * 20),
            maxLimit = Math.round(this.playlist.length * SLIDER_SIZE),
            lineLimits = [], spots = [];

        // station_id => $element
        this.links = {};
        this.$el.html(this.template());

        var $lines = this.$('ul');

        _.times($lines.size(), function(){
            lineLimits.push(0);
        });
        for (var i = maxLimit; 0 <= i; i--) {
            spots.push(i * SLIDER_SIZE);
        }

        // рисуем ссылки
        var i = 0;
        do {
            var spot = spots.pop(),
                pos = _.min(lineLimits),
                lineIndex = _.indexOf(lineLimits, pos);
            if (!(0 < pos && spot + SLIDER_SIZE < pos)) {
                var station = this.playlist.at(i++);
                if (!station) {
                    break;
                }
                var $station = $(this.make('li', {'class': 'station'}, station.escape('title')));
                if (!station.get('is_online')) {
                    $station.prepend('<i class="offline" />');
                }
                var leftPos = spot + (pos ? SLIDER_SIZE : 0);
                $station = $station.data('id', station.id).css('left', leftPos).appendTo($lines[lineIndex]);
                lineLimits[lineIndex] = spot + $station.width() + space;
                this.links[station.id] = $station;
            }
        } while (spots.length);

        /**
         * меняем ширину контейнера
         * когда контент выходит за границы экрана.
         */
        var viewOverflow = _.max(lineLimits) > $(window).width();
        this.$el.parent().toggleClass('movable', viewOverflow);
        this.$el.css('width', viewOverflow ? _.max(lineLimits) : '100%');

        // обновляем полосу прокрутки
        this.updateScrollbar();
    },

    setupScrollbar: function() {
        $('.radio-scroll').tinyscrollbar({axis: 'x'});
        // обновляем позицию прокрутки при ресайзе окна
        $(window).resize(_.throttle(_.bind(this.updateScrollbar, this), 200));
    },

    updateScrollbar: function(position) {
        $('.radio-scroll').tinyscrollbar_update(position);
    }
});

/**
 * Представление поиска
 *
 * @type {function}
 */
App.SearchView = App.View.extend({
    el: '.search',
    recentSelector: null,

    events: {
        'keyup .search-input': 'changeText',
        'click .clear-icon': 'clearAndRestore'
    },

    initialize: function(options) {
        this.playlist = options.playlist;
        this.selectors = options.selectors;
        this.selectors.on('select', function(selector) {
            this.recentSelector = selector;
            // при выборе селетора, очищаем поиск
            this.clear();
        }, this);
        this.showPlaceholder();
    },

    // состыковка с полем ввода
    dockPopup: function() {
        var offset = this.$(':text').offset();
        offset.top += Math.ceil(this.$(':text').height() / 2);
        this.$('.search-popup').offset(offset);
    },

    showPopup: function(type) {
        this.$('.search-popup').html(App.i18n('display.search.' + type)).show();
        this.dockPopup();
    },

    changeText: _.debounce(function() {
        this.$('.search-popup').hide();
        var query = $.trim(this.$(':text').val());
        if (query) {
            this.$el.addClass('fill');
            this.selectors.unselectAll();
            this.search(query);
        } else {
            this.clearAndRestore();
        }
    }, 200),

    clear: function() {
        this.$el.removeClass('fill');
        this.$(':text').val('');
        this.$('.search-popup').hide();
    },

    clearAndRestore: function() {
        this.clear();
        if (this.recentSelector) {
            var selector = this.selectors.get(this.recentSelector);
            selector.select();
        }
    },

    search: function(query) {
        var self = this;
        var result = this.playlist.fetchBySelector('search/' + query);
        result.done(function(){
            if (!self.playlist.length) {
                self.showPopup('404');
            }
        });
        result.fail(function(){
            self.showPopup('500');
        });
    }
});

/**
 * Представление кнопок навигации по шкале.
 *
 * @type {function}
 */
App.DisplayControlsView = App.View.extend({
    el: '.radio-controls',
    events: {
        'click .prev': 'selectPrevious',
        'click .next': 'selectNext'
    },

    initialize: function(options) {
        this.playlist = options.playlist;
    },

    selectPrevious: function() {
        this.playlist.previous();
        return false;
    },

    selectNext: function() {
        this.playlist.next();
        return false;
    }
});

/**
 * Контролер шкалы, селекторов и поиска.
 *
 * Селектор плейлиста это строка запроса к серверу,
 * типа /api/playlist/<selector>
 *
 * Переключение с селектора на поиск и обратно в
 * @see SearchView
 *
 * Глобальное событие playlist:station_changed(Station).
 *
 * @type {Function}
 */

App.RadioDisplay = function() {
    this.initialize.apply(this, arguments);
};

_.extend(App.RadioDisplay.prototype, {
    mediator: App.mediator,

    initialize: function() {
        this.playlist = new App.Playlist();
        this.playlist.publishEvents('station_changed', this.mediator, 'playlist');

        this.selectors = new App.Selectors();
        this.selectors.playlist = this.playlist;

        new App.SelectorsView({selectors: this.selectors});
        new App.DisplayView({playlist: this.playlist});
        new App.SearchView({playlist: this.playlist, selectors: this.selectors});
        new App.DisplayControlsView({playlist: this.playlist});

        this.selectors.add([
            new App.FavoriteSelector({hint: App.i18n('display.selectors.favorite')}),
            new App.FeaturedSelector({title: App.i18n('display.selectors.featured')})
        ]);

        // когда пользователь жмет на большую кнопку, проигрывается первая станция
        this.mediator.on('player:power', function(){
            this.playlist.next();
        }, this);
    },

    setGenres: function(genres) {
        // теги
        _.each(genres, function(genre) {
            this.selectors.add(new App.Selector({title: genre.title, selector: 'genre/' + genre.id}));
        }, this);
    }
});


$(function(){
    App.radioDisplay = new App.RadioDisplay();
});