var App = App || {};

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
    },

    login: function(params) {
        if (this.isLogged()) {
            return;
        }
        return $.post(this.url + 'login', params, this._callback('login_error'));
    },

    signup: function(params) {
        if (this.isLogged()) {
            return;
        }
        return $.post(this.url + 'signup', params, this._callback('signup_error'));
    },

    logout: function() {
        if (!this.isLogged()) {
            return;
        }

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
        'keyup': '_validate'
    },
    valid: false,

    initialize: function(options) {
        this.user = options.user;
        this.user.on('logged logout', this.render, this);
        // вывод ошибки логина
        this.user.on('login.error', function(error){
            var text = App.i18n('login.error.' + error);
            this.$('.notice').addClass('notice-error').show().text(text);
        }, this);
        this.render();
    },

    render: function() {
        this.$el.html(this.template()).toggle(!this.user.isLogged());
    },

    // проверка заполненности полей
    _validate: function() {
        var valid = true;
        this.$(':text, :password').each(function(){
            var val = $.trim(this.value);
            if (!val) {
                valid = false;
            }
        });
        this.$(':submit').prop('disabled', !valid);
        this.valid = valid;
    },

    submit: function() {
        this._validate();
        if (!this.valid) {
            return false;
        }
        this.loadingButton(function(){
            return this.user.login(this.serializeForm());
        });
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
        'click .favorites': 'favorites',
        'click .settings': 'settings'
    },

    initialize: function(options) {
        this.user = options.user;
        this.user.on('logged logout change', this.render, this);
    },

    render: function() {
        if (this.user.isLogged()) {
            this.$el.show().html(this.template(this.user.toJSON()));
        } else {
            this.$el.hide();
        }
    },

    logout: function() {
        this.user.logout();
        return false;
    },

    favorites: function() {
        this.trigger('favorites');
        return false;
    },

    settings: function() {
        this.trigger('settings');
        return false;
    }
});

/**
 * Представление-лейаут выезжающей сверху панели.
 *
 * @type {function}
 */
App.TopBox = App.View.extend({
    el: '.top-box',
    events: {
        'click .close': 'hide'
    },

    show: function(view) {
        if (this.view) {
            this.view.remove();
        }
        view.on('hide', this.hide, this);
        view.on('render', function(render){
            this.$el.html(render);
        }, this);
        this.$el.html(view.render());
        this.$el.show().animate({marginTop: 0}, 'linear', _.bind(function(){
            this.$('form :text:first').focus();
            this.$('.close').show();
        }, this));
        this.view = view;
    },

    hide: function() {
        if (this.view) {
            this.view.remove();
            this.view = null;
        }
        var $el = this.$el;
        $el.animate({marginTop: $el.height() * -1}, 'linear', function(){
            $el.hide();
        });
        this.$('.close').hide();
        this.trigger('hide');
    }
});

/**
 * Абстрактное представление формы для TopBox.
 *
 * @type {function}
 */
App.TopBoxForm = App.View.extend({
    hide: function() {
        this.trigger('hide');
    },

    setupValidator: function() {
        this.validator = new FormValidator(this.$el, this.validation);
        this.validator.on('field', function(node, error) {
            this.$('label.error').remove();
            if (error) {
                node.removeClass('valid');
                node.after($('<label class="error">').text(error));
            } else {
                node.addClass('valid');
            }
        }, this);

        this.validator.on('valid', function(valid) {
            this.$(':submit').prop('disabled', !valid);
        }, this);

        this.validator.validateForm();
        this.$('input').bind('textchange', _.bind(this._removeErrorNotice, this));
    },

    _removeErrorNotice: function() {
        if (!this.errorNotice) {
            return;
        }
        this.errorNotice.remove();
        this.errorNotice = false;
        this.$('.notice').show();
    },

    /**
     * Вывод сообщения об ошибке под формой.
     *
     * @param error string - html или текст
     */
    showError: function(error) {
        // обычный хинт скрываем и добавляем новый хинт с ошибкой
        this.errorNotice = $('<p class="notice error">').html(error);
        this.$('.notice').hide().before(this.errorNotice);
    }
});

/**
 * Форма регистрации.
 *
 * @type {function}
 */
App.UserSignup = App.TopBoxForm.extend({
    template: App.getTemplate('user_signup'),
    validation: {
        rules: {
            email: {required: true, email: true},
            password: {required: true, minlength: 6}
        },
        messages: App.i18n('signup.validation')
    },
    events: {
        'submit': 'submit'
    },

    initialize: function() {
        this.model.on('signup_error', this.error, this);
        this.model.on('logged', this.hide, this);
    },

    render: function() {
        var $content = $(this.template());
        this.setElement($content.find('form'));
        this.setupValidator();
        return $content;
    },

    submit: function() {
        this.loadingButton(function(){
            return this.model.signup(this.serializeForm());
        });
        return false;
    },

    error: function(code) {
        this.showError(App.i18n('signup.error.' + code));
    }
});

/**
 * Форма восстановления пароля.
 *
 * @type {function}
 */
App.UserAmnesia = App.TopBoxForm.extend({
    template: App.getTemplate('user_amnesia'),
    result: App.getTemplate('password_reset'),
    validation: {
        rules: {
            email: {required: true, email: true}
        },
        messages: App.i18n('amnesia.validation')
    },
    events: {
        'submit': 'submit'
    },

    initialize: function() {
        this.model.on('amnesia_error', this.error, this);
        this.model.on('password_reset', this.passwordReset, this);
    },

    render: function() {
        var $content = $(this.template({email: this.email}));
        this.setElement($content.find('form'));
        this.setupValidator();
        return $content;
    },

    submit: function() {
        this.loadingButton(function(){
            return this.model.amnesia(this.serializeForm());
        });
        return false;
    },

    passwordReset: function(params) {
        // эвент обновляет контент плашки
        this.trigger('render', this.result(params));
    },

    error: function(code) {
        this.showError(App.i18n('amnesia.error.' + code));
    }
});

App.UserRouter = Backbone.Router.extend({
    routes: {
        'signup': 'signup',
        'amnesia': 'amnesia',
        'user/favorites': 'favorites',
        'user/settings': 'settings'
    },

    initialize: function(options) {
        this.user = options.user;
        this.topbox = new App.TopBox();
        this.topbox.on('hide', this.navigateToPrevious, this);

        this.panelbox = new App.PanelBox();
    },

    /**
     * Регистрация
     */
    signup: function() {
        this.topbox.show(new App.UserSignup({model: this.user}));
    },

    /**
     * Сброс пароля
     */
    amnesia: function() {
        this.topbox.show(new App.UserAmnesia({model: this.user}));
    },

    /**
     * Избранные треки
     */
    favorites: function() {
        if (!this.user.isLogged()) {
            this.navigate('/');
        }
        this.panelbox.show(new App.UserFavoritesView());
    },

    /**
     * Настройки аккаунта
     */
    settings: function() {
        if (!this.user.isLogged()) {
            this.navigate('/');
        }
        //this.panelbox.show(new App.UserFavoritesView());
    },

    navigateToPrevious: function() {
        this.navigate('/', {replace: true});
    }
});

App.PanelBox = App.View.extend({
    events: {
        'click .close': 'hide'
    },

    show: function(view) {
        if (this.view) {
            this.view.remove();
        }
        view.on('hide', this.hide, this);
        view.on('render', function(render){
            this.$el.html(render);
        }, this);
        this.$el.html(view.render());
        this.$el.show();
        this.view = view;
    },

    hide: function() {
        if (this.view) {
            this.view.remove();
            this.view = null;
        }
        this.$el.hide();
        this.trigger('hide');
    }
});

App.UserFavoritesView = App.View.extend({
    hide: function() {
        this.trigger('hide');
    }
});

/**
 * Хелпер для юзерской граватарки.
 */
Handlebars.registerHelper('user_gravatar_url', function(user, size) {
    var url = 'http://www.gravatar.com/avatar/' + user.gravatar_hash + '?s=' + size,
        avatar_name = (user.sex == 'female') ? 'avatar_female.png' : 'avatar.png';
    // gravatar хостит дефолтные изображения, поэтому на локалхосте URL будет недоступен.
    // меняем на заглушку по умолчанию
    var default_url = App.debug ? 'mm' : encodeURIComponent(App.getUrl('static/i/' + avatar_name));
    url += '&d=' + default_url;
    return url;
});

$(function(){
    App.user = new App.User();
    App.userBar = new App.UserBarView({user: App.user});
    App.loginForm = new App.LoginFormView({user: App.user});
    App.userRouter = new App.UserRouter({user: App.user});
})