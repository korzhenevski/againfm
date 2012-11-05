var App = App || {};

App.UserSettings = App.Model.extend();

App.User = App.Model.extend({
    url: '/api/user/',
    mediator: App.mediator,

    initialize: function() {
        this.publishEvents('logged logout', this.mediator, 'user');
        this.on('change:id', function() {
            if (this.isLogged()) {
                this.trigger('logged', this);
            } else {
                this.trigger('logout');
            }
        }, this);
        // кидаем событие при изменении настроек
        this.on('change:settings', function(model, settings){
            var previousSettings = this.previous('settings') || {};
            _.each(settings, function(val, key){
                if (val !== previousSettings[key]) {
                    this.mediator.trigger('playback:' + key, val);
                }
            }, this)
        })
    },

    login: function(params) {
        return $.post(this.url + 'login', params, this._callback('login_error'));
    },

    signup: function(params) {
        return $.post(this.url + 'signup', params, this._callback('signup_error'));
    },

    logout: function() {
        var self = this;
        return $.post(this.url + 'logout').always(function(){
            self.clear();
        });
    },

    amnesia: function(params) {
        return $.post(this.url + 'amnesia', params, _.bind(function(result){
            if (result.error) {
                this.trigger('amnesia_error', result.error);
            } else {
                this.trigger('password_reset', result);
            }
        }, this));
    },

    changeName: function(params) {
        return $.post(this.url + 'change_name', params, this._callback('change_name_error'));
    },

    saveSettings: function() {
        return $.ajax({
            url: this.url + 'settings',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(this.get('settings'))
        })
    },

    // фабрика возвращает колбек который при ошибке с сервера
    // генерирует нужное событие
    _callback: function(error_event) {
        return _.bind(function(user){
            if (user.error) {
                this.trigger(error_event, user.error);
            } else {
                this.set(user);
            }
        }, this);
    },

    isLogged: function() {
        return this.has('id');
    }
});

/**
 * Представление формы логина.
 *
 * @type {function}
 */
App.LoginFormView = App.View.extend({
    el: 'form.login',
    template: App.getTemplate('user_login'),
    events: {
        'submit': 'submit',
        'keyup': '_validate',
        'click .signup': 'showSignup',
        'click .amnesia': 'showAmnesia'
    },
    valid: false,
    mediator: App.mediator,

    initialize: function(options) {
        this.topbox = new App.TopBox();
        this.user = options.user;
        this.user.on('logged logout', this.render, this);
        // вывод ошибки логина
        this.user.on('login_error', function(error){
            error = App.i18n('login.error.' + error);
            this.$('.notice').addClass('notice-error').text(error);
        }, this);
        this.$('input').bind('textchange', _.bind(this._clearError, this));
        this.render();
    },

    _clearError: function() {
        this.$('.notice').removeClass('notice-error').text('');
    },

    showSignup: function() {
        this.topbox.show(new App.UserSignup({model: this.user}));
    },

    showAmnesia: function() {
        this.topbox.show(new App.UserAmnesia({model: this.user}));
    },

    render: function() {
        this.$el.html(this.template());
        this.showPlaceholder();
        if (this.user.isLogged()) {
            this.$el.hide();
        } else {
            this.$el.fadeIn();
        }
    },

    // проверка заполненности полей
    _validate: function() {
        var valid = true;
        this.$(':text, :password').each(function(){
            var val = $.trim(this.value);
            if (!val || val == $(this).attr('placeholder')) {
                valid = false;
            }
        });
        this.$(':submit').prop('disabled', !valid);
        this.valid = valid;
    },

    submit: function() {
        this._clearError();
        this._validate();
        if (!this.valid) {
            return false;
        }
        this.ajaxButton(function(){
            return this.user.login(this.serializeForm());
        }, 'loading');
        return false;
    }
});

/**
 * Пользовательская плашка
 *
 * @type {function}
 */
App.UserBarView = App.View.extend({
    el: '.user-profile',
    template: App.getTemplate('userbar'),
    events: {
        'click .logout': 'logout',
        'click .favorites': 'showFavorites',
        'click .settings': 'showSettings'
    },
    mediator: App.mediator,

    initialize: function(options) {
        this.user = options.user;
        this.user.on('logged logout change', this.render, this);
        this.favorites = new App.UserFavorites();
    },

    render: function() {
        if (this.user.isLogged()) {
            this.$el.fadeIn().html(this.template(this.user.toJSON()));
        } else {
            this.$el.hide();
        }
    },

    showFavorites: function() {
        var view = new App.UserFavoritesView({collection: this.favorites})
        this.mediator.trigger('panelbox:show', view, 'favorites');
    },

    showSettings: function() {
        var view = new App.UserSettingsView({model: this.user});
        this.mediator.trigger('panelbox:show', view, 'settings');
    },

    logout: function() {
        this.user.logout();
        return false;
    }
});

App.UserFavorite = App.Model.extend({
    mediator: App.mediator,
    // этот извращенский подход вызван нежеланием создавать кучу item-view для большого избранного
    toggleBookmark: function() {
        var self = this,
            track_id = this.get('track').id;
        return $.post('/api/user/bookmark/track/' + track_id, function(track){
            self.set('favorite', track.favorite);
            self.mediator.trigger('user_favorites:change', track_id, track.favorite);
        });
    },

    toJSON: function() {
        var json = _.clone(this.attributes);
        json['cid'] = this.cid;
        return json;
    }
});

App.UserFavorites = App.Collection.extend({
    url: '/api/user/favorites',
    model: App.UserFavorite,
    mediator: App.mediator,

    initialize: function() {
        // обновляем список при
        // - входе юзера
        // - добавлении/удалении трека с мини-дисплея
        this.mediator.on('user:logged sticker:bookmark_track', function(){
            this.fetch();
        }, this);
        this.mediator.on('user:logout', function(){
            this.reset();
        }, this);
    },

    comparator: function(model) {
        return model.get('created_at');
    }
});

/**
 * Хелпер для юзерской граватарки.
 */
Handlebars.registerHelper('user_gravatar_url', function(email_hash, size) {
    var url = 'http://www.gravatar.com/avatar/' + email_hash + '?s=' + size;
    // gravatar хостит дефолтные изображения, поэтому на локалхосте URL будет недоступен.
    // меняем на заглушку по умолчанию
    var default_url = App.debug ? 'mm' : encodeURIComponent(App.getUrl('static/i/avatar2.png'));
    url += '&d=' + default_url;
    return url;
});

$(function(){
    App.user = new App.User();
    App.userBar = new App.UserBarView({user: App.user});
    App.loginForm = new App.LoginFormView({user: App.user});
    App.panelBox = new App.PanelBox();
});