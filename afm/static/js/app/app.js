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

App.Collection = Backbone.Collection.extend({
    parse: function(response, xhr) {
        /**
         * flask jsonify возвращает только объекты
         */
        return response['objects'];
    }
});

App.Station = App.Model.extend({});

/**
 * Translate wrapper
 *
 * @param key string
 * @return {string}
 */
App.i18n = function(key) {
    return $.i18n.t(key);
}

/**
 * Global events mediator
 *
 * @type {object}
 */
App.mediator = _.clone(Backbone.Events);

/**
 * Template helper that
 * load and runtime compile on development env
 * or simple return precompiled template on production
 *
 * @param name string - Template name
 * @return {object}
 */
App.getTemplate = function(name) {
    if (!Handlebars.templates[name]) {
        $.ajax({
            url: '/static/js/templates/' + name + '.handlebars',
            async: false,
            success: function(data) {
                Handlebars.templates[name] = Handlebars.compile(data);
            }
        });
    }
    return Handlebars.templates[name];
};
Handlebars.templates = Handlebars.templates || {};

/**
 * i18n template helper
 */
Handlebars.registerHelper('t', function(key) {
    return new Handlebars.SafeString(App.i18n(key));
});