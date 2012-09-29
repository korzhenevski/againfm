/*display view
search view
playlist
filters*/


// TODO: rename grid to display

App.Playlist = App.Collection.extend({
    model: App.Station,
    _state: {},
    _selector: 'default',

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

    fetchBySelector: function(selector) {
        this._selector = selector;
        var xhr = this.fetch();
        xhr.always(_.bind(this.restoreSelectedStation, this));
    },

    restoreSelectedStation: function() {
        var snapshot = this._state[this._selector];
        if (snapshot) {
            this.setStation(this.get(snapshot.currentStation.id));
        }
    }
});

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
        if (this.collection) {
            this.collection.select(this);
        }
        this.set('active', true);
    },

    unselect: function() {
        this.set('active', false);
    },

    getTitle: function() {
        return this.get('title');
        /*if (!title) {
            var key = 'display.filters.' + this.get('selector');
            title = App.i18n(key);
            if (title == key) {
                title = '';
            }
        }
        return title;*/
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
        context['class'] = context['selector'].split('/')[0]
        this.setElement(this.template(context));
        return this.el;
    },

    select: function() {
        this.model.collection.unselectAll();
        this.model.select();
    }
});

App.Selectors = App.Collection.extend({
    model: App.Selector,
    selectedId: null,

    unselectAll: function() {
        return _.invoke(this.where({'active': true}), 'unselect');
    },

    select: function(model) {
        if (this.selectedId != model.id) {
            this.selectedId = model.id;
            this.trigger('select', model.id);
        }
    }
});

App.FavoriteSelector = App.Selector.extend({
    mediator: App.mediator,

    initialize: function() {
        this.set('visible', false);
        this.set('selector', 'favorite');
        this.mediator.on('user:logged', this.show, this);
        this.mediator.on('user:logout', this.hide, this);
    }
});

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

App.DisplayView = App.View.extend({
    el: '.radio-scale .scale-inner',
    scrollEl: '.radio-scroll',
    cursorEl: '.scale-slider',
    events: {
        'click .station': 'selectStation'
    },

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
        this.$el.find('.active-station').removeClass('active-station');

        var $link = this.links[station.id];
        $link.addClass('active-station');

        // прокрутка до видимой зоны если ссылка за пределами шкалы
        // правый край
        var scrollLeft = Math.round(this.$el.position().left * -1),
            scrollShift = $link.position().left + $link.width() * 2;
        scrollShift -= scrollLeft + this.$el.parent().width();
        if (scrollShift > 0) {
            console.log('overflow right');
            var scrollPos = scrollLeft + scrollShift;
            var maxScrollPos = this.$el.width() - this.$el.parent().width();
            if (scrollPos > maxScrollPos) {
                scrollPos = maxScrollPos;
            }
            this.updateScrollbar(scrollPos);
        }
        // левый край
        if ($link.position().left < scrollLeft) {
            console.log('overflow left');
            this.updateScrollbar($link.position().left);
        }

        // меняем позицию бегунка, позиционирование на середину ширины ссылки
        var $cursor = this.$el.find(this.cursorEl),
            halfWidth = Math.round(($link.width() + 13) / 2),
            cursorLeft = $link.scrollLeft() + $link.position().left + halfWidth;
        $cursor.show().animate({left: cursorLeft});
    },

    /**
     * Обработка клика по ссылке и обновление в плейлисте
     *
     * @param e event
     */
    selectStation: function(e) {
        var station = this.playlist.get($(e.target).data('id'));
        this.playlist.setStation(station);
    },

    /**
     * этот код писали обкуренные черти
     * TODO: переписать без всяких spots и прочей хуйни
     */
    render: function() {
        var SLIDER_SIZE = 13,
            MAX_LINES = 4,
            space = 150 - Math.round(Math.log(this.playlist.length) * 20),
            maxLimit = Math.round(this.playlist.length * SLIDER_SIZE),
            $lines = [],
            lineLimits = [];

        this.$el.html('');
        // station_id => $element
        this.links = {};

        // создаем линии
        for (var i = 0; i < MAX_LINES; i++) {
            lineLimits.push(0);
            var $line = $(this.make('ul', {'class': 'line'+(i+1)}));
            $lines.push($line.appendTo(this.$el));
        }

        for (var spots = [], i = maxLimit; 0 <= i; i--) {
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
                var leftPos = spot + (pos ? SLIDER_SIZE : 0);
                $station = $station.data('id', station.id).css('left', leftPos).appendTo($lines[lineIndex]);
                lineLimits[lineIndex] = spot + $station.width() + space;
                this.links[station.id] = $station;
            }
        } while (spots.length);

        // помечаем пустые линии
        _.each($lines, function(line) {
            var $line = $(line);
            if (!$line.find('li').size()) {
                $line.addClass('empty-line');
            }
        });

        /**
         * меняем ширину контейнера
         * когда контент выходит за границы экрана.
         */
        var viewOverflow = _.max(lineLimits) > $(window).width();
        this.$el.parent().toggleClass('movable', viewOverflow);
        if (viewOverflow) {
            this.$el.css('width', _.max(lineLimits));
        } else {
            this.$el.css('width', '100%');
        }

        // обновляем полосу прокрутки
        this.updateScrollbar();

        // слайдер обязательно внутри прокручиваемого контента
        this.$el.append('<div class="scale-slider"></div>');
    },

    setupScrollbar: function() {
        $(this.scrollEl).tinyscrollbar({axis: 'x'});
        // обновляем позицию прокрутки при ресайзе окна
        $(window).resize(_.throttle(_.bind(this.updateScrollbar, this), 200))
    },

    updateScrollbar: function(position) {
        $(this.scrollEl).tinyscrollbar_update(position);
    }
});

App.RadioDisplay = function() {
    this.initialize.apply(this, arguments);
}

App.RadioDisplay.prototype = {
    initialize: function(options) {
        var options = _.defaults(options || {}, {tags: []});

        this.playlist = new App.Playlist();
        this.selectors = new App.Selectors();
        this.selectors.on('select', this.select, this);

        this.selectorsView = new App.SelectorsView({selectors: this.selectors});
        this.displayView = new App.DisplayView({playlist: this.playlist});

        this.selectors.add([
            new App.FavoriteSelector({title: 'Favorites'}),
            new App.Selector({selector: 'featured'})
        ]);
        for (var i = options.tags.length; i > 0; i--) {
            var tag = options.tags[i - 1];
            this.selectors.add(new App.Selector({title: tag.title, selector: 'tag/' + tag.tag}));
        }
    },

    select: function(selector) {
        this.playlist.fetchBySelector(selector);
    }
}


$(function(){
    App.radioDisplay = new App.RadioDisplay({tags: [
        {title: "House", tag: "house"},
        {title: "Trance", tag: "trance"}
    ]});
    App.radioDisplay.selectors.get('tag/trance').select();
})

/*
App
    Radio
        Player
        Teaser
        TeaserView
        SpectrumView



    RadioDisplay
        Filters
        FiltersView
        SearchView
        DisplayView
    User
*/