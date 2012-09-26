var App = App || {};
var render = render || {};

App.Radio = App.Model.extend({
    history: {},

    setStation: function(station) {
        if (this.station && this.station.id == station.id) {
            return;
        }

        this.station = station;
        this.selectStream();
        this.trigger('change_station', this);

        this.history[station.id] = station;
        this.trigger('history_available');
    },

    setStream: function(stream) {
        this.stream = stream;
        this.trigger('change_stream', this);
    },

    selectStream: function() {
        if (!this.station) {
            return;
        }
        var self = this;
        return $.getJSON('/api/stream_for_station/' + this.station.get('id'), {
            'low_bitrate': App.user.settings.trafficThrottling()
        }).success(function(stream){
            self.setStream(stream);
        }).error(function(){
            self.setStream(null);
        });
    },

    getHistory: function() {
        return _.values(this.history);
    }
});

App.Station = App.Model.extend({
    urlRoot: '/api/station/',
    defaults: {
        title: gettext('Untitled'),
        image: ''
    }
});

App.Playlist = App.Collection.extend({
    model: App.Station,
    url: '/api/playlist/',

    initialize: function(options) {
        this.id = 'featured';
        this.on('reset', this.restoreCurrentId, this);
        this.currentId = null;
        this.stateCache = {};
    },

    restoreCurrentId: function() {
        if (this.stateCache[this.id]) {
            this.currentId = this.stateCache[this.id];
            this.changeStation(this.currentId);
        }
    },

    next: function() {
        if (this.currentId) {
            var index = _.indexOf(this.models, this.get(this.currentId));
            if (index >= 0) {
                if (++index >= this.length) {
                    index = 0;
                }
            } else {
                index = 0;
            }
            this.changeStation(this.models[index].id);
        } else if (this.length) {
            this.changeStation(this.first().id);
        }
    },

    previous: function() {
        if (this.currentId) {
            var index = _.indexOf(this.models, this.get(this.currentId));
            if (index >= 0) {
                if (--index < 0) {
                    index = this.length - 1;
                }
            } else {
                index = 0;
            }
            this.changeStation(this.models[index].id);
        }
    },

    changeStation: function(id) {
        this.currentId = id;
        this.stateCache = {};
        this.stateCache[this.id] = this.currentId;
        this.trigger('change_station', this.get(id));
    },

    fetchById: function(id) {
        this.id = id;
        this.currentId = null;
        this.fetch({action: id});
    },

    comparator: function(model) {
        return model.get('order');
    }
});


App.Filter = App.Model.extend({
    defaults: {
        order: 10,
        role: 'category',
        hidden: false
    },

    show: function() {
        this.set('hidden', false);
    },

    select: function() {
        this.set('is_active', true);
        if (this.collection) {
            this.collection.trigger('select', this);
        }
    },

    unselect: function() {
        this.set('is_active', false);
    },

    toJSON: function() {
        var json = App.Model.prototype.toJSON.apply(this, arguments);
        return json;
    }
});

App.HomeFilter = App.Filter.extend({
    defaults: {
        order: 0,
        id: 'home',
        role: 'home',
        is_active: true
    }
});

App.HistoryFilter = App.Filter.extend({
    defaults: {
        order: 5,
        title: gettext('History'),
        id: 'history',
        role: 'history',
        hidden: true
    },

    initialize: function() {
        App.radio.bind('history_available', _.bind(this.show, this));
    }
});

App.Filters = App.Collection.extend({
    model: App.Filter,
    url: '/api/playlist/categories/',

    comparator: function(model) {
        return model.get('order');
    },

    unselect: function() {
        return _.invoke(this.where({'is_active': true}), 'unselect');
    }
});

App.FilterItem = App.View.extend({
    events: {
        'click': 'select'
    },

    render: function() {
        this.setElement(render.filter_item(this.model.toJSON()));
        return this;
    },

    select: function() {
        if (!this.model.get('is_active')) {
            this.model.collection.unselect();
            this.model.select();
        }
    }
});

App.FiltersView = App.View.extend({
    el: '.filters',

    initialize: function(options) {
        this.filters = options.filters;
        this.filters.on('reset add change', this.render, this);
    },

    render: function() {
        var $list = this.$el.html('');
        this.filters.each(function(model) {
            if (!model.get('hidden')) {
                var filter = new App.FilterItem({model: model});
                $list.append(filter.render().el);
            }
        });
    }
});

/**
 * 3 chars - realtime fetch stations
 * empty input - restore previous scale view
 * not found - dropdown box - "hui vam a ne radio"
 *
 * @type {*}
 */
App.RadioSearchView = App.View.extend({
    el: '.search-input',
    initialize: function() {
        this.render();
    },

    render: function() {
        this.$el.autocomplete({
            source: function(request, response) {
                $.getJSON('/api/search', {
                    term: request.term
                }, function (resp) {
                    response(resp.results || []);
                });
            },
            select: function () {
                console.log(arguments);
                return false;
            },
            focus: function () {
                return false;
            },
            appendTo: '.search',
            position: {
                at: "left center"
            }
        }).data('autocomplete')._renderItem = function (ul, item) {
            var $item = $(render.autocomplete_item(item).outerHtml());
            return $item.data('item.autocomplete', item).appendTo(ul);
        };
    }
});

App.RadioDisplayView = App.View.extend({
    el: '.radio-scale .scale-inner',
    events: {
        'click .station-link': 'stationClick'
    },

    initialize: function(options) {
        this.playlist = options.playlist;
        this.playlist.on('reset', this.toggleSliderVisibility, this);
        this.playlist.on('reset', this.render, this);
        this.playlist.on('change_station', this.select, this);
        this.search = new App.RadioSearchView();
        this.setupScroll();
    },

    setupScroll: function() {
        $('.radio-scroll').tinyscrollbar({axis: 'x'});
        $(window).resize(_.throttle(_.bind(this.updateScroll, this), 200))
    },

    updateScroll: function() {
        $('.radio-scroll').tinyscrollbar_update();
    },

    render: function() {
        var i = 0,
            SLIDER_SIZE = 15,
            MAX_LINES = 4;

        var space = 150 - Math.round(Math.log(this.playlist.length) * 20);
        var maxLimit = Math.round(this.playlist.length * SLIDER_SIZE);
        var lines = 4;

        /*
         * Dynamic lines count
         * Math.round(this.playlist.length / (maxLimit / MAX_LINES)) + 1;
         * lines > MAX_LINES && (lines = MAX_LINES); lines || (lines = 1);
         **/
        for (var limits = [], linesHTML = [], i = 1; i <= lines; i++) {
            limits.push(0);
            linesHTML.push('<ul class="line' + i + '"></ul>');
        }

        this.$el.html(linesHTML.join(''));
        var $lines = this.$el.find('ul');
        for (spots = [], i = maxLimit; 0 <= i; i--) {
            spots.push(i * SLIDER_SIZE);
        }

        var i = 0;
        // assoc stationId -> $(display item)
        this.map = {};
        this.selectedIndex = 0;

        do {
            var spot = spots.pop(),
                m = _.min(limits),
                ml = _.indexOf(limits, m);
            if (!(0 < m && spot + 15 < m)) {
                var station = this.playlist.at(i++);
                if (!station) {
                    break;
                }
                var stationId = station.get('id');
                var $station = $('<li>').html(station.escape('title')).attr({
                    'class': 'station-link',
                    'id': 'station-' + station.id
                }).data('station-id', station.id).css('left', spot + (m ? 15 : 0)).appendTo($lines[ml]);
                limits[ml] = spot + $station.width() + space;
            }
        } while (spots.length);

        this.$el.append('<div class="scale-slider"></div>');

        $lines.each(function() {
            var $line = $(this);
            if (!$line.find('li').size()) {
                $line.addClass('empty-line');
            }
        });

        var scrollable = (_.max(limits) > $(window).width());
        if (scrollable) {
            this.$el.css('width', _.max(limits));
        } else {
            this.$el.css('width', '100%');
        }
        $('.radio-scale').toggleClass('movable', scrollable);
        this.updateScroll();

        // TODO: dirty hack
        if (this.playlist.currentId) {
            this.select(this.playlist.currentId);
        }
    },

    stationClick: function(e) {
        var $el = $(e.target);
        this.playlist.changeStation($el.data().stationId);
    },

    select: function(station, duration) {
        var stationId = station.id ? station.id : station;
        var $station = $('#station-'+stationId);
        if ($station) {
            var left = $station.scrollLeft() + $station.position().left + 13;
            this.$el.find('.scale-slider').show().animate({left: left}, duration, 'linear');
            this.$el.find('.active-station').removeClass('active-station');
            $station.addClass('active-station');
        }
    },

    hideSlider: function() {
        this.$el.find('.scale-slider').hide();
    },

    //  playlist context
    toggleSliderVisibility: function(playlist) {
        if (!playlist.currentId) {
            this.hideSlider();
        }
    }
});

App.Player = function() {
    this.initialize.apply(this, arguments);
};

_.extend(App.Player.prototype, Backbone.Events, {
    _player: null,
    fading: true,

    initialize: function() {
        var proxiedMethods = 'getVolume,mute,unmute,playStream,isPaused'.split(',');
        _.each(proxiedMethods, function(method) {
            if (!_.has(this, method)) {
                this[method] = _.bind(function() {
                    if (this._player) {
                        //  swf functions not support JS apply
                        //  wrap only functions without arguments
                        return this._player[method]();
                    }
                }, this);
            }
        }, this);
        this.setupEvents();
    },

    setupEvents: function() {
        var self = this;

        App.user.settings.on('change:fading_sound', function(obj, value) {
            self.fading = value;
        }, this);

        App.radio.on('change_stream', function(mediator) {
            self.loadStreamByUrl(mediator.stream['url'], true);
        });
    },

    pauseStream: function() {
        this._player[this.fading ? 'pauseStreamWithFade' : 'pauseStream']();
    },

    stopStream: function() {
        this._player[this.fading ? 'stopStreamWithFade' : 'stopStream']();
    },

    loadStreamByUrl: function(url, startPlay) {
        this._player.loadStreamByUrl(url, startPlay);
    },

    setVolume: function(volume) {
        this._player.setVolume(volume);
    },

    throttleTraffic: function(throttle) {
        throttle = !!throttle;
        this._player.throttleTraffic(throttle);
    },

    getSpectrum: function(points) {
        return this._player.getSpectrum(points);
    },

    embedTo: function(id, params) {
        var params = params || {};
        // Callback events
        // * ready - SWF ready
        // * error - radio load error
        swfobject.embedSWF(App.config.static_url + 'swf/player.swf', id, 1, 1, '10', '', params, {
            'allowscriptaccess': 'always'
        }, {}, _.bind(this._onLoad, this));
    },

    _onLoad: function(e) {
        if (e.success) {
            this._player = e.ref;
        } else {
            console.error('player load fail');
        }
    }
});

App.Onair = App.Model.extend({});

App.RadioNow = App.Model.extend({
    defaults: {
        title: '',
        caption: '',
        image_url: ''
    }
});

App.RadioNowView = App.View.extend({
    el: '.radio-now',
    events: {
        'click .star': 'clickStar'
    },

    initialize: function(options) {
        _.bindAll(this, 'render', 'stationChanged', 'streamChanged',
            'trackUpdate', 'radioUnavailable', 'subscribeTrackUpdate', 'stopTrackUpdate');

        this.player = options.player;
        this.player.on('error', this.radioUnavailable);
        this.player.on('play', this.subscribeTrackUpdate);
        this.player.on('paused', this.stopTrackUpdate);

        this.content = new App.RadioNow();
        this.content.on('change', this.stopUnavailableTimer, this);
        this.content.on('change', this.render);

        App.radio.on('change_station', this.stationChanged);
        App.radio.on('change_stream', this.streamChanged);

        var user = App.user;
        user.on('logged logout', this.render);
        user.favorites.on('favorite:toggle', this.render);

        this.statusUnavailableTimeout = 20000;
        this.notfoundIcon = App.config.static_url + 'i/display/notfound.png';
        this.loadingIcon = App.config.static_url + 'i/display/loading.png';
        preloadImage(this.notfoundIcon, this.loadingIcon);
    },

    stationChanged: function(mediator) {
        this.content.set({
            station_title: mediator.station.get('title')
        }, {silent: true});
        this.content.set({
            id: null,
            title: $.t('radio.loading'),
            caption: '',
            image_url: this.loadingIcon
        });
        this.startUnavailableTimer();
    },

    streamChanged: function(mediator) {
        this.subscribeTrackUpdate({
            'station_id': mediator.station.get('id'),
            'stream_id': mediator.stream['id']
        });
    },

    startUnavailableTimer: function() {
        this.stopUnavailableTimer();
        this._unavailableStatusTimer = setTimeout(_.bind(this.infoUnavailable, this), this.statusUnavailableTimeout);
    },

    stopUnavailableTimer: function() {
        if (this._unavailableStatusTimer) {
            clearTimeout(this._unavailableStatusTimer);
        }
    },

    stopTrackUpdate: function() {
        App.cometfm.unsubscribe();
    },

    subscribeTrackUpdate: function(params) {
        if (params) {
            this._cometParams = params
        } else {
            params = this._cometParams;
        }

        var cometfm = App.cometfm;
        if (!cometfm) {
            return;
        }

        if (App.user.isLogged()) {
            params['user_id'] = App.user.get('id')
        }

        cometfm.subscribe(params, this.trackUpdate);
    },

    trackUpdate: function(track) {
        var data = {};
        if (track.artist && track.name) {
            data.title = track.name;
            data.caption = track.artist;
        } else if (track.title) {
            data.title = track.title;
        }
        data.image_url = track.image_url || this.notfoundIcon;
        data.id = track.id || 0;
        this.content.set(data);
        return this;
    },

    getContent: function() {
        var content = this.content.toJSON();
        var user = App.user;
        if (user.isLogged() && content.id) {
            content.star_class = 'star';
            if (content['faved']) {
                content.star_class += ' star-selected';
            }
        }
        // skip image loading, if traffic throttling active
        if (user.settings.trafficThrottling()) {
            content.image_url = this.notfoundIcon;
        }
        return content;
    },

    render: function() {
        if (!this.content.get('station_title')) {
            return;
        }
        var html = render.radio_now(this.getContent());
        var self = this;
        this.$el.show().fadeOut(500, function(){
            $(this).html(html).fadeIn(500, function(){
                self.marqueeTitle();
            });
        });
    },

    marqueeTitle: function() {
        var $title = this.$el.find('.title-inner');
        var delta = $title.width() - $title.parent().width();
        if (delta > 5) {
            /**
             * load - wait 5 sec - marquee - wait 3 - marquee
             */
            $title.stop();
            $title.parent().addClass('shadow');
            var marquee = function(delta) {
                var data = {};
                data['margin-left'] = delta < 0 ? 0 : -1 * delta;
                $title.delay(5000).animate(data, Math.abs(delta) * 35, 'linear', function() {
                    marquee(-delta);
                });
            }
            marquee(delta);
        } else {
            $title.parent().removeClass('shadow');
        }
    },

    infoUnavailable: function() {
        this.content.set({
            'title': $.t('radio.error.info_unavailable'),
            'caption': '',
            'image_url': this.notfoundIcon,
            'id': null
        });
    },

    radioUnavailable: function() {
        this.content.set({
            'title': $.t('radio.error.radio_unavailable'),
            'caption': '',
            'image_url': this.notfoundIcon,
            'id': null
        });
    },

    clickStar: function(e) {
        if (!App.user.isLogged()) {
            return false;
        }
        var $star = $(e.target);
        var meta_id = $star.data('id');
        alert(meta_id);
    }
});

App.Spectrum = function() {
    this.initialize.apply(this, arguments);
}

_.extend(App.Spectrum.prototype, {
    initialize: function() {
        this.$el = $('#spectrum');
        this.ctx = this.$el.get(0).getContext('2d');
        this.limit = 300;
        this.running = false;
        this.colors = ['#d86b26', '#d72f2e', '#0f9ac5'];
        this.animateInterval = 100;
        _.bindAll(this, '_animate', 'pullSpectrum', '_updateSize', 'drawBlankLine');
        App.player.on('play', _.bind(this.start, this));
        App.player.on('paused', _.bind(this.stop, this));
        App.radio.on('change_station', _.bind(this.stop, this));
        this._updateSize();
        $(window).resize(_.throttle(this._updateSize, 200));
    },

    _updateSize: function() {
        this.width = this.$el.width();
        this.height = this.$el.height();
        this.lineSize = Math.floor(this.limit / this.colors.length);
        this.renderStep = Math.round(this.width / this.lineSize);
    },

    start: function() {
        this.running = true;
        this.clear();

        this.spectrum = [];
        this.points = [];
        for (var i = 0; i < this.limit; ++i) {
            this.points[i] = 68;
        }

        this._animate();
        requestAnimFrame(this.pullSpectrum);
    },

    stop: function() {
        this.running = false;
        this.clear();
        requestAnimFrame(this.drawBlankLine);
    },

    drawBlankLine: function() {
        this.clear();
        var ctx = this.ctx,
            color = '#f3f3f3',
            height = 68;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 4;

        ctx.moveTo(0, height);
        ctx.lineTo(this.width, height);
        ctx.stroke();
    },

    _animate: function() {
        var completed = 0;
        var size = this.spectrum.length;
        if (!size) {
            this.spectrum = App.player.getSpectrum(this.limit);
        }
        for (var i = 0; i < size; i++) {
            var diff = this.spectrum[i] - this.points[i];
            if (Math.abs(diff) > 0) {
                var val = this.points[i] + diff * 0.02;
                if (Math.round(val) >= this.spectrum[i]) {
                    val = this.spectrum[i];
                    ++completed;
                }
                this.points[i] = val;
            } else {
                ++completed;
            }
        }

        if (size) {
            this.render();
        }

        if (this.running) {
            requestAnimFrame(_.bind(this._animate, this));
        }
    },

    render: function() {
        this.clear();

        for(var lineIndex = 0; lineIndex < this.colors.length; lineIndex++) {
            var pos = 0,
                points = [],
                lim = (lineIndex + 1) * this.lineSize;
            var maxVal = this.height - 10;
            for (var i = lineIndex * this.lineSize; i < lim; i++) {
                var val = this.points[i];
                if (val > maxVal) {
                    val = maxVal;
                }
                if (val < 0) {
                    val = 10;
                }
                points.push([pos, val]);
                pos = pos + this.renderStep;
            }

            this.drawCurve(points, this.colors[lineIndex]);
        }
    },

    drawCurve: function(points, color) {
        var factor = 0.4,
            linewidth = 1,
            ctx = this.ctx;
        ctx.beginPath();

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 4;

        ctx.strokeStyle = color;
        ctx.lineWidth = linewidth;
        var len = points.length;

        for (var i = 0; i < len; ++i) {
            if (points[i] && typeof(points[i][1]) == 'number' && points[i + 1] && typeof(points[i + 1][1]) == 'number') {
                var coordX = points[i][0];
                var coordY = points[i][1];
                var nextX = points[i + 1][0];
                var nextY = points[i + 1][1];
                var prevX = points[i - 1] ? points[i - 1][0] : null;
                var prevY = points[i - 1] ? points[i - 1][1] : null;
                var offsetX = (points[i + 1][0] - points[i][0]) * factor;
                var offsetY = (points[i + 1][1] - points[i][1]) * factor;

                if (i == 0) {
                    ctx.moveTo(coordX, coordY);
                    ctx.lineTo(nextX - offsetX, nextY - offsetY);
                } else if (nextY == null) {
                    ctx.lineTo(coordX, coordY);
                } else if (prevY == null) {
                    ctx.moveTo(coordX, coordY);
                } else if (coordY == null) {
                    ctx.moveTo(nextX, nextY);
                } else {
                    ctx.quadraticCurveTo(coordX, coordY, coordX + offsetX, coordY + offsetY);
                    if (nextY) {
                        ctx.lineTo(nextX - offsetX, nextY - offsetY);
                    } else {
                        ctx.lineTo(coordX, coordY);
                    }
                }
            } else if (typeof(points[i][1]) == 'number') {
                ctx.lineTo(points[i][0], points[i][1]);
            }
        }
        ctx.stroke();
    },

    pullSpectrum: function() {
        this.spectrum = App.player.getSpectrum(this.limit);
        if (this.running) {
            requestAnimFrame(this.pullSpectrum);
        }
    },

    clear: function() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
});

App.RadioControlsView = App.View.extend({
    el: '.radio-controls',
    events: {
        'click .play': 'controlPlay',
        'click .prev': 'controlPrevious',
        'click .next': 'controlNext',
        'click .sound': 'controlSound'
    },

    initialize: function() {
        App.radio.on('change_stream', _.bind(this.toggleBitrateIndicator, this));
        var vol = $.cookie('volume');
        var isNightLimit = App.user.settings.hasNightVolumeLimit();
        if (vol !== null) {
            this.volume = isNightLimit ? App.config.night_volume : vol;
        } else {
            this.volume = App.config.default_volume;
        }
        this.$el.find('.sound').toggleClass('sound-off', this.volume === 0).show();
        this.isMuted = false;
        this.render();
    },

    toggleBitrateIndicator: function(mediator) {
        var $indicator = this.$el.find('.hd');
        if (mediator.stream['is_hd']) {
            $indicator.show();
        } else {
            $indicator.hide();
        }
    },

    render: function() {
        this.$el.find('.slider').slider({
            range: 'min',
            value: this.volume,
            slide: _.throttle(_.bind(this.changeVolume, this), 100)
        });
    },

    changeVolume: function(e, ui) {
        var volume = ui.value;
        var $sound = this.$el.find('.sound');
        if (volume) {
            $sound.removeClass('sound-off');
            this.isMuted = false;
        } else {
            $sound.addClass('sound-off');
        }
        this.setVolume(volume);
    },

    setVolume: function(volume) {
        this.volume = volume;
        App.player.setVolume(this.volume);
        $.cookie('volume', this.volume);
    },

    controlPlay: function() {
        var player = App.player;
        if (player.isPaused()) {
            player.playStream();
        } else {
            player.stopStream();
        }
        return false;
    },

    controlPrevious: function() {
        App.playlist.previous();
        return false;
    },

    controlNext: function() {
        App.playlist.next();
        return false;
    },

    controlSound: function() {
        var $control = this.$el.find('.sound');
        var $slider = this.$el.find('.slider');
        if ($control.is('.sound-off')) {
            if (this.isMuted) {
                $control.removeClass('sound-off');
                App.player.unmute();
                $slider.slider('value', App.player.getVolume());
                $.cookie('volume', App.player.getVolume());
                this.isMuted = false;
            }
        } else {
            App.player.mute();
            $slider.slider('value', 0);
            $.cookie('volume', 0);
            $control.addClass('sound-off');
            this.isMuted = true;
        }
    }
});

/**
 * play station on window focus
 */