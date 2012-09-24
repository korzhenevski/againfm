/*display view
search view
playlist
filters*/

App.Playlist = App.Collection.extend({
    model: App.Station,
    _state: {},
    _query: 'default',

    initialize: function() {
        // track station for restore playlist current
        this._trackSelectedStation();
    },

    url: function() {
        return '/api/playlist/' + this._query;
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

    fetchByQuery: function(query) {
        this._query = query;
        this.fetch();
    },

    _trackSelectedStation: function() {
        this.on('station_changed', function(station){
            this._state = {};
            this._state[this._query] = {currentStation: station};
        });

        this.on('reset', function(){
            var snapshot = this._state[this._query];
            if (snapshot) {
                this.setStation(this.get(snapshot.currentStation.id));
            }
        });
    }
});

App.Filter = App.Model.extend({
    defaults: {
        visible: true,
        active: false,
        order: 0
    },

    show: function() {
        this.set('visible', true);
    },

    hide: function() {
        this.set('visible', false);
    },

    select: function() {
        this.set('active', true);
        if (this.collection) {
            this.collection.trigger('select', this);
        }
    },

    unselect: function() {
        this.set('active', false);
    }
});

App.Filters = App.Collection.extend({
    model: App.Filter,

    comparator: function(model) {
        return model.get('order');
    },

    unselect: function() {
        return _.invoke(this.where({'active': true}), 'unselect');
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
        this.model.collection.unselect();
        this.model.select();
    }
});

/*
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
*/