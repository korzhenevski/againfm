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
        this.streams = new Admin.StreamList();
        this.listView = new Admin.ImportListView({
            collection: this.collection,
            streams: this.streams
        });
        this.stationView = new Admin.ImportStationView({
            streams: this.streams
        });
    },

    submit: function() {
        var url = $.trim(this.$('input[name=url]').val());
        if (!url) {
            return false;
        }
        var self = this;
        var $button = this.$('.fetch :submit');
        $button.button('loading');
        $.getJSON('/admin/import/fetch', {url: url}, function(response){
            if (response && response.streams) {
                self.collection.reset(response.streams);
            }
        }).always(function(){
            $button.button('reset');
        }).fail(function(){
            alert('fetch error');
        });
        return false;
    }
});

Admin.ImportListView = Backbone.View.extend({
    el: '.select',
    template: Admin.getTemplate('import_table'),
    events: {
        'keyup .search': 'search',
        'click .toggle': 'toggle',
        'click .item': 'toggleItem',
        'click .push': 'pushToStation'
    },

    initialize: function(options) {
        this.streams = options.streams;
        this.collection.on('reset change', this.render, this);
    },

    pushToStation: function() {
        var streams = this.streams.pluck('url');
        var newStreams = this.collection.filter(function(item){
            return item.get('selected') && !_.contains(streams, item.get('url'));
        });
        this.streams.add(newStreams);
    },

    renderList: function(list) {
        this.$('.table').html(this.template({list: list.toJSON()}));
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

Admin.ImportStationView = Backbone.View.extend({
    el: '.station',
    template: Admin.getTemplate('station_streams'),
    events: {
        'submit': 'submit',
        'change .title': 'trackTitle'
    },

    initialize: function(options) {
        this.streams = options.streams;
        this.streams.on('reset add', this.render, this);
        this.$('[name=title]').typeahead({source: this._searchTitle});
    },

    render: function() {
        this.$('.table').html(this.template({streams: this.streams.toJSON()}));
    },

    _searchTitle: function(query, process) {
        return $.getJSON('/api/playlist/search/' + query, function(response){
            if (response && response.objects) {
                process(_.map(response.objects, function(object){
                    return object.title + ' id:'+object.id;
                }));
            }
        });
    },

    trackTitle: function(e) {
        var title = $(e.currentTarget).val(),
            streams = this.streams,
            idMatch = /.+id:(\d+)/g.exec(title);
        if (idMatch) {
            this.stationId = parseInt(idMatch[1]);
            $.getJSON('/admin/import/station/streams/' + this.stationId, function(response){
                if (response && response.streams) {
                    streams.reset(response.streams);
                }
            })
        } else {
            this.stationId = null;
        }
    },

    submit: function() {
        var station = {
            title: $.trim(this.$('[name=title]').val()),
            tags: $.trim(this.$('[name=tags]').val())
        };

        if (!station.title) {
            return false;
        }

        if (this.stationId) {
            station.id = this.stationId;
            delete station.title;
        }

        station.streams = this.streams.pluck('url');
        station.tags = _.compact(station.tags.split(','))

        var $label = this.$('.text-info').text('');
        var $button = this.$(':submit');
        $button.button('loading');
        $.ajax({
            url: '/admin/import/station/save',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(station)
        }).always(function(){
            $button.button('reset');
        }).fail(function(){
            alert('save error');
        }).done(function(result){
            $label.text('Station '+result.station_id+' saved!');
        });

        return false;
    }
});