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

    login: function(params, options) {
        if (this.isLogged()) {
            return;
        }

        var self = this;
        $.post(this.url + 'login', params, function(user){
            if (user.error) {
                self.trigger('login.error', user.error);
            } else {
                self.set(user);
            }
        });
    },

    logout: function() {
        if (!this.isLogged()) {
            return;
        }

        var self = this;
        $.post(this.url + 'logout').always(function(){
            self.clear();
        });
    },

    isLogged: function() {
        return this.has('id');
    }
});

App.FormView = App.View.extend({
    initialize: function(options) {
        this.render();
    },

    render: function() {
        this.validator();
    },

    validator: function() {
        var options = $.extend({
            focusInvalid: false,
            //onfocusout: true,
            //onkeyup: true,
            ignoreTitle: true
        }, this.validation);
        console.log(options);
        return this.$el._validate(options);
    }
});

App.LoginFormView = App.FormView.extend({
    el: 'form.login',
    validation: {
        validClass: false,
        rules: {
            login: {required: true},
            password: {required: true}
        }
    },

    initialize: function() {
        //this.validation.success = _.bind(function() {
        //    console.log('success');
        //}, this);
        this.validation.showErrors = _.bind(function() {
            console.log(arguments);
            this.$(':submit').prop('disabled', true);
        }, this);
        this.render();
    },

    toggleButton: function() {

    },

    submit: function() {

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
            this.$('.notice').addClass('notice-error').show().text(error);
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
        this.user.login(this.serializeForm());
        return false;
    }
});

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

/***
 * Это результат выжимки необходимого функционала из jquery.validation.js
 * только без ебанутого интерфейса и кода писанного чертями
 *
 * @type {function}
 */
var FormValidator = App.klass({
    errors: {},
    valid: {},
    validators: {
        required: function($el) {
            return $.trim($el.val()).length > 0;
        },

        email: function($el) {
            return /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test($el.val());
        },

        minlength: function($el, minlen) {
            return $el.val().length >= minlen;
        },

        maxlength: function($el, maxlen) {
            return $el.val().length <= maxlen;
        }
    },

    /**
     * Валидатор.
     *
     * @param form - форма
     * @param options - настройки валидации
     */
    initialize: function(form, options) {
        this.options = options;
        this.form = $(form);
        // валидаторы срабатывают по тексту и смене фокуса
        this.form.on('keyup blur', _.bind(this._validate, this));
        // блокируем submit если форма невалидна
        this.form.submit(_.bind(function(){
            return this.isValid();
        }, this));
        _.each(options.rules, function(rule, name){
            this.valid[name] = false;
        }, this);
    },

    _validate: function(e) {
        var $target = $(e.target),
            name = $target.attr('name'),
            rule = this.options.rules[name];
        if (!rule) {
            return;
        }

        delete this.errors[name];
        _.each(rule, function(param, validator_name){
            var validator = this.validators[validator_name];
            if (!validator || this.errors[name]) {
                return;
            }
            if (!validator($target, param)) {
                this.errors[name] = this.options.messages[name][validator_name] || validator_name + ' error';
            }
        }, this);

        this.valid[name] = !this.errors[name];
        this.trigger('field', $target, this.errors[name]);
        this.trigger('valid', this.isValid());
    },

    isValid: function() {
        return _.all(_.values(this.valid), _.identity);
    }
});

/**
 * Представление для выпадающих сверху плашек.
 * Обеспечивает анимацию и валидацию формы.
 *
 * @type {function}
 */
App.TopHolderView = App.View.extend({
    el: '.top-holder',
    // базовый шаблон
    layout: App.getTemplate('top_holder'),
    events: {
        'click .close': 'hide',
        'submit': 'submit'
    },
    // заголовок плашки, может быть i18n-ключем
    title: '',
    // классы для обертки,
    // нужны для кастомизации заголовков лейаута
    layoutClass: '',

    show: function() {
        this.render();
        var $el = this.$('.form-holder');
        $el.show().animate({marginTop: 0}, 'linear', function() {
            $el.find(':text:first').focus();
        });
        return this;
    },

    hide: function() {
        var $el = this.$('.form-holder');
        $el.animate({marginTop: $el.height() * -1}, 'linear', _.bind(function() {
            $el.hide();
            this.trigger('hide');
        }, this));
        return this;
    },

    render: function() {
        this.$el.html(this.layout({
            title: App.i18n(this.title),
            layout_class: this.layoutClass,
            content: this.template()
        }));
        this.setupValidator();
    },

    setupValidator: function() {
        this.validator = new FormValidator(this.$('form'), this.validation);
        this.validator.on('field', function($el, error) {
            $el.parents('.form-input').find('label.error').remove();
            if (error) {
                $el.addClass('error').removeClass('valid');
                $el.after($('<label class="error">').text(error));
            } else {
                $el.removeClass('error').addClass('valid');
            }
        }, this);

        this.validator.on('valid', function(valid) {
           this.$('form :submit').prop('disabled', !valid);
        }, this);
    }
});

/**
 * Форма регистрации.
 *
 * @type {function}
 */
App.UserSignupView = App.TopHolderView.extend({
    template: App.getTemplate('user_signup'),
    title: 'signup.title',
    validation: {
        rules: {
            email: {required: true, email: true},
            password: {required: true, minlength: 6}
        },
        messages: App.i18n('signup.validation')
    },
    submit: function() {

    }
});

/**
 * Форма восстановления пароля.
 *
 * @type {function}
 */
App.UserAmnesiaView = App.TopHolderView.extend({
    template: App.getTemplate('user_amnesia'),
    layoutClass: 'amnesia-holder',
    title: 'amnesia.title',
    validation: {
        rules: {
            email: {required: true, email: true}
        },
        messages: App.i18n('amnesia.validation')
    }
});

App.UserRouter = Backbone.Router.extend({
    routes: {
        'signup': 'signup',
        'amnesia': 'amnesia'
    },

    signup: function() {
        if (!this.signupView) {
            this.signupView = new App.UserSignupView();
            this.signupView.on('hide', this.navigateToPrevious, this);
        }
        this.signupView.show();
    },

    amnesia: function() {
        if (!this.amnesiaView) {
            this.amnesiaView = new App.UserAmnesiaView();
            this.amnesiaView.on('hide', this.navigateToPrevious, this);
        }
        this.amnesiaView.show();
    },

    navigateToPrevious: function() {
        this.navigate('/');
    }
});

/**
 *
 */
Handlebars.registerHelper('user_gravatar_url', function(user, size) {
    var url = 'http://www.gravatar.com/avatar/' + user.gravatar_hash + '?s=' + size,
        avatar_name = (user.sex == 'female') ? 'avatar_female.png' : 'avatar.png';
    url += '&d=' + encodeURIComponent(App.getUrl('static/i/' + avatar_name));
    return url;
});

$(function(){
    App.user = new App.User();
    App.userBar = new App.UserBarView({user: App.user});
    App.loginForm = new App.LoginFormView({user: App.user});
    App.userRouter = new App.UserRouter();
})