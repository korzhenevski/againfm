var App = App || {};

App.Model = Backbone.Model.extend({
    // TODO: migrate from options callbacks to deferred promise
    callAction: function(action, data, options) {
        return this.save({}, _.extend(options || {}, {
            action: action,
            data: $.param(data)
        }));
    },

    parseActionError: function(resp, acceptedCodes) {
        if (resp.responseText && _.include(acceptedCodes, resp.status)) {
            return $.parseJSON(resp.responseText).error;
        } else {
            console.log(arguments);
            console.error(resp);
        }
        return false;
    }
});

App.View = Backbone.View.extend({
    show: function() {
        this.$el.show();
        return this;
    },

    hide: function() {
        this.$el.hide();
        return this;
    },

    toggle: function() {
        this.$el.toggle();
        return this;
    },

    showRender: function() {
        this.render();
        this.show();
    }
});

App.Collection = Backbone.Collection.extend({});

App.Station = App.Model.extend({});
