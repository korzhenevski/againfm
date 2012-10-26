var Admin = Admin || {};

Admin.getTemplate = function(name) {
    if (!Handlebars.templates[name]) {
        $.ajax({
            url: '/admin/static/js/templates/' + name + '.handlebars',
            async: false,
            success: function(data) {
                Handlebars.templates[name] = Handlebars.compile(data);
            }
        });
    }
    return Handlebars.templates[name];
};
Handlebars.templates = Handlebars.templates || {};


Admin.Stream = Backbone.Model.extend({
    defaults: {
        selected: true
    },

    toggleSelection: function() {
        this.set('selected', !this.get('selected'));
    },

    toJSON: function() {
        var json = _.clone(this.attributes);
        json['cid'] = this.cid;
        return json;
    }
});

Admin.StreamList = Backbone.Collection.extend({
    model: Admin.Stream
});

Admin.ImportView = Backbone.View.extend({
    el: '.import',
    events: {
        'submit .fetch': 'submit'
    },

    initialize: function() {
        this.collection = new Admin.StreamList();
        this.list = new Admin.ImportListView({collection: this.collection});
    },

    submit: function() {
        var url = $.trim(this.$('input[name=url]').val());
        if (!url) {
            return false;
        }
        var self = this;
        var $button = this.$('.fetch :submit');
        $button.button('loading');
        //this.collection.reset([{"url": "http://94.25.53.133/nashe-48"}, {"url": "http://94.25.53.133/nashe-192"}, {"url": "http://94.25.53.133/ultra-48"}, {"url": "http://94.25.53.133/nashe-96"}, {"url": "http://94.25.53.133/rock-192"}, {"url": "http://94.25.53.133/best-192"}, {"url": "http://94.25.53.133/ultra-128"}, {"url": "http://94.25.53.133/ultra-320"}, {"url": "http://94.25.53.133/nashe-128"}, {"url": "http://94.25.53.133/ultra-96"}, {"url": "http://94.25.53.133/ultra-64"}, {"url": "http://94.25.53.133/ultra-192"}, {"url": "http://94.25.53.133/ru-192"}]);
        $.getJSON('/admin/import/fetch', {url: url}, function(response){
            if (response && response.streams) {
                self.collection.reset(response.streams);
            }
        }).always(function(){
            $button.button('reset');
        });
        return false;
    }
});

Admin.ImportStationView = Backbone.View.extend({

});

Admin.ImportListView = Backbone.View.extend({
    el: '.save',
    template: Admin.getTemplate('import_table'),
    station_template: Admin.getTemplate('station_streams'),
    events: {
        'keyup .search': 'search',
        'click .toggle-selection': 'toggle',
        'click .item': 'toggleItem',
        'click .add': 'addToStation',
        'click .clear': 'clearStreams',
        'change .station-title': 'stationChanged',
        'submit .station-save': 'saveStation'
    },

    initialize: function() {
        this.streams = new Admin.StreamList();
        this.streams.on('reset add', this.renderStationStreams, this);
        this.collection.on('reset change', this.render, this);
        this.$('.station-title').typeahead({source: this._typeaheadSearch});
    },

    saveStation: function() {
        var data = {streams: this.streams.pluck('url')};
        if (this.stationId) {
            data.id = this.stationId;
        } else {
            data.title = $.trim(this.$('.station-title').val());
            var tags = $.trim(this.$('.station-tags').val());
            data.tags = _.compact(tags.split(','));
        }
        return $.ajax({
            url: '/admin/import/station/save',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data)
        });
        return false;
    },

    addToStation: function() {
        var streams = this.streams.pluck('url');
        var newStreams = this.collection.filter(function(item){
            return item.get('selected') && !_.contains(streams, item.get('url'));
        });
        this.streams.add(newStreams);
    },

    clearStreams: function() {
        this.streams.reset();
    },

    renderStationStreams: function() {
        this.$('.station-streams').html(this.station_template({streams: this.streams.toJSON()}));
    },

    _typeaheadSearch: function(query, process) {
        return $.getJSON('/api/playlist/search/' + query, function(response){
            if (response && response.objects) {
                process(_.map(response.objects, function(object){
                    return object.title + ' id:'+object.id;
                }));
            }
        });
    },

    stationChanged: function(e) {
        var title = $(e.currentTarget).val();
        var streams = this.streams;
        var match = /.+id:(\d+)/g.exec(title);
        if (match) {
            this.stationId = parseInt(match[1]);
            $.getJSON('/admin/import/station/streams/' + this.stationId, function(response){
                if (response && response.streams) {
                    streams.reset(response.streams);
                }
            })
        } else {
            this.stationId = null;
        }
    },

    renderList: function(list) {
        this.$('.import-table').html(this.template({list: list.toJSON()}));
    },

    render: function() {
        this.renderList(this.collection);
    },

    toggleItem: function(e) {
        var data = $(e.currentTarget).data();
        var model = this.collection.getByCid(data.cid);
        if (model) {
            model.toggleSelection();
        }
        return false;
    },

    toggle: function(e) {
        var $button = $(e.currentTarget);
        var selected = !!$button.data('selected');
        $button.data('selected', !selected);
        this.collection.each(function(item){
            item.set('selected', selected);
        });
        return false;
    },

    search: function(e) {
        var query = $.trim($(e.currentTarget).val());
        if (!query) {
            if (this.wholeCollection) {
                this.collection.reset(this.wholeCollection.toJSON());
                this.wholeCollection = null;
            }
            return;
        }
        if (!this.wholeCollection) {
            this.wholeCollection = _.clone(this.collection);
        }
        var pattern = new RegExp(query, 'gi');
        var list = this.wholeCollection.filter(function(item){
            return pattern.test(item.get('url'));
        });
        this.collection.reset(list);
    }
});