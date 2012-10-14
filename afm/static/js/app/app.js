var App = App || {};

App.Model = Backbone.Model.extend({});

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

function padzero(val) {
    val = '' + val;
    if (val) {
        if (val.length == 1) {
            return '0' + val;
        } else {
            return val;
        }
    }
    return '00';
}

/**
 * Человекочитаемое значение прошедшей даты от таймстемпа.
 * Возвращает локализованное значение: сегодня, вчера, YYYY.MM.DD
 *
 * @param ts int - unix timestrap
 * @return {string}
 */
App.datediff = function(ts) {
    var res;
    var date = new Date(ts * 1000),
        diff = Math.round(((new Date().getTime()) - date.getTime()) / 1000);

    if (diff <= 86400) {
        res = 'today';
    } else if (diff <= 86400 * 2) {
        res = 'yesterday'
    }

    if (res) {
        return App.i18n('timediff.' + res);
    }

    return date.getFullYear() + '.' + padzero(date.getMonth()) + '.' + padzero(date.getDate());
};

/**
 * Возвращает время по таймстемпу.
 *
 * @param ts int - unix timestrap
 * @return {string}
 */
Handlebars.registerHelper('time', function(ts){
    var date = new Date(ts * 1000);
    return padzero(date.getHours()) + ':' + padzero(date.getMinutes());
});


/**
 * Декоратор ссылок. Предваряет путь решеткой, если нет HTML5 pushState.
 */
Handlebars.registerHelper('link', function(uri) {
    return '#' + uri;
});

/**
 * Абстрактное представление c хелперами.
 *
 * @type {function}
 */
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
    },

    /**
     * Сериализует данные формы в объект.
     *
     * @return {Object}
     */
    serializeForm: function() {
        var $el = this.$el.is('form') ? this.$el : this.$('form');
        var serialized = {};
        if ($el && $el.size()) {
            _.each($el.serializeArray(), function(field){
                serialized[field.name] = field.value;
            })
        }
        return serialized;
    },

    /**
     * Хелпер для смены состояния кнопки при ajax-запросе.
     *
     * @param callback - колбек возвращающий Deferred
     */
    loadingButton: function(callback) {
        var $submit = this.$(':submit');
        $submit.button('loading');
        callback.apply(this).always(function(){
            $submit.button('reset');
        });
    }
});

App.Collection = Backbone.Collection.extend({
    parse: function(response, xhr) {
        /**
         * flask jsonify возвращает только объекты
         */
        return response.objects;
    }
});

App.Station = App.Model.extend({});

/**
 * Translate wrapper
 *
 * @param key string
 * @return {string}
 */
App.i18n = function(key, options) {
    var chunks = key.split('.'),
        val = App.i18n_dict[chunks[0]];
    if (val) {
        for (var i = 1, len = chunks.length; i < len; i++) {
            val = val[chunks[i]];
        }
    }
    var def = options && !_.isUndefined(options.default) ? options.default : key;
    return val || def;
};

// как-то громоздко, потенциально надо упростить
(function(){
    /**
     * Проксирует эвенты из одного объекта в другой.
     *
     * Полезно использовать для передачи событий в глобальный медиатор.
     *
     * @param events string - имена событий (разделенные пробелом)
     * @param destObj object - получатель эвентов
     * @param prefix string - (необязательно) префикс новых событий
     */
    function publishEvents(events, destObj, prefix) {
        events = events.split(' ');
        var self = this;
        prefix = prefix ? (prefix + ':') : '';
        _.each(events, function(event){
            self.on(event, function(){
                var args = _.toArray(arguments);
                args.unshift(prefix + event);
                destObj.trigger.apply(destObj, args);
            });
        });
    }

    App.Model.prototype.publishEvents = publishEvents;
    App.View.prototype.publishEvents = publishEvents;
    App.Collection.prototype.publishEvents = publishEvents;
    Backbone.Events.publishEvents = publishEvents;
})();

/**
 * Фабрика классов.
 *
 * @param proto - прототип
 * @return {Function}
 */
App.klass = function(proto) {
    var klass = function() {
        if (this.initialize) {
            this.initialize.apply(this, arguments);
        }
    };
    _.extend(klass.prototype, Backbone.Events, proto);
    return klass;
};

/**
 * Глобальный посредник событий.
 *
 * @type {object}
 */
App.mediator = _.clone(Backbone.Events);

/**
 * Возвращает абсолютный путь с доменом и протоколом.
 *
 * @param path - относительный путь
 * @return {String} - абсолютный путь
 */
App.getUrl = function(path) {
    var loc = document.location;
    return loc.protocol + '//' + loc.hostname + '/' + (path ? path : '');
};

/**
 * Уведомляем компоненты о выгрузке окна.
 */
$(window).bind('beforeunload', function(){
    App.mediator.trigger('app:unload');
});


/**
 * i18n template helper
 */
Handlebars.registerHelper('t', function(key) {
    return new Handlebars.SafeString(App.i18n(key));
});

App.mediator.on('all', function(){
    console.log('[mediator]', arguments);
});