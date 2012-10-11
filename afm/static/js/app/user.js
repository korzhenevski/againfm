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
        $.post(this.url + 'login', params, this._callback('login_error'));
    },

    signup: function(params) {
        if (this.isLogged()) {
            return;
        }
        $.post(this.url + 'signup', params, this._callback('signup_error'));
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

    amnesia: function(params, callback) {
        $.post(this.url + 'amnesia', params, _.bind(function(result){
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
        'click .close': 'slideUp'
    },
    // дочерняя модель перечисляет какие эвенты от юзера ей интересны
    user_events: {},
    // заголовок плашки, может быть i18n-ключем
    title: '',
    // классы для обертки,
    // нужны для кастомизации заголовков лейаута
    layout_class: '',
    mediator: App.mediator,

    initialize: function(options) {
        this.user = options.user;
        _.bindAll(this, 'submit');
        _.each(this.user_events, function(callback, event){
            this.user.on(event, this[callback], this);
        }, this);
        // показываем только одну плашку, остальные скрываются
        // следим по событию
        this.mediator.on('top_holder:show', function(view){
            if (view != this) {
                this.$holder.hide();
            }
        }, this);
    },

    slideDown: function() {
        this.mediator.trigger('top_holder:show', this);
        this.render_layout(this.render());
        var $el = this.$holder;
        $el.show().animate({marginTop: 0}, 'linear', function() {
            // ставим фокус на первое текстовое поле
            var $text = $el.find(':text:first');
            if ($text.val()) {
                // если поле уже содержит текст,
                // эмулируем нажатие для срабатывания валидатора и разблокировки формы
                // (формы с одним полем будут рады)
                $text.keyup();
            } else {
                $text.focus();
            }
        });
        return this;
    },

    slideUp: function() {
        var $el = this.$holder;
        $el.animate({marginTop: $el.height() * -1}, 'linear', _.bind(function() {
            $el.hide();
            this.trigger('hide');
        }, this));
        return this;
    },

    render_layout: function(content) {
        this.$el.html(this.layout({
            title: App.i18n(this.title),
            layout_class: this.layout_class,
            content: content
        }));
        this.$holder = this.$('.form-holder');
        var $form = this.$('form');
        if ($form) {
            this.setupValidator($form);
            $form.submit(this.submit);
        }
    },

    render: function() {
        return this.template();
    },

    setupValidator: function($form) {
        this.validator = new FormValidator($form, this.validation);
        this.validator.on('field', function($el, error) {
            this.$('label.error').remove();
            if (error) {
                $el.removeClass('valid');
                $el.after($('<label class="error">').text(error));
            } else {
                $el.addClass('valid');
            }
        }, this);

        this.$('form').on('keyup', 'input', _.bind(function(){
            // при обновлении статуса формы
            // восстанавливаем первоначальный хинт
            if (this.errorNotice) {
                this.errorNotice.remove();
                this.errorNotice = false;
                this.$('.notice').show();
            }
            console.log('restore');
        }, this));

        this.validator.on('valid', function(valid) {
           this.$('form :submit').prop('disabled', !valid);
        }, this);
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
App.UserSignupView = App.TopHolderView.extend({
    template: App.getTemplate('user_signup'),
    email_exists: App.getTemplate('user_email_exists'),
    title: 'signup.title',
    validation: {
        rules: {
            email: {required: true, email: true},
            password: {required: true, minlength: 6}
        },
        messages: App.i18n('signup.validation')
    },
    user_events: {
        'signup_error': 'signupError',
        'logged': 'slideUp'
    },

    submit: function() {
        this.user.signup(this.serializeForm());
        return false;
    },

    signupError: function(error) {
        if (error == 'email_exists') {
            // если адрес уже существует, показываем ссылку на форму
            // где куда прокидываем адрес почты
            this.showError(this.email_exists({
                email: this.$('input[name=email]').val()
            }));
        } else {
            this.showError(error);
        }
    }
});

/**
 * Форма восстановления пароля.
 *
 * @type {function}
 */
App.UserAmnesiaView = App.TopHolderView.extend({
    template: App.getTemplate('user_amnesia'),
    layout_class: 'amnesia-holder',
    title: 'amnesia.title',
    result: App.getTemplate('password_reset'),
    validation: {
        rules: {
            email: {required: true, email: true}
        },
        messages: App.i18n('amnesia.validation')
    },
    user_events: {
        'amnesia_error': 'passwordReset',
        'password_reset': 'passwordReset',
        'logged': 'slideUp'
    },
    // подставляется в форму
    email: '',

    render: function() {
        return this.template({email: this.email});
    },

    submit: function() {
        this.user.amnesia(this.serializeForm());
        return false;
    },

    passwordReset: function(params) {
        this.render_layout(this.result(params));
    }
});

App.UserRouter = Backbone.Router.extend({
    routes: {
        'signup': 'signup',
        'amnesia': 'amnesia',
        'amnesia/:email': 'amnesia'
    },

    initialize: function(options) {
        this.user = options.user;
    },

    signup: function() {
        if (!this.signupView) {
            this.signupView = new App.UserSignupView({user: this.user});
            this.signupView.on('hide', this.navigateToPrevious, this);
        }
        this.signupView.slideDown();
    },

    amnesia: function(email) {
        if (!this.amnesiaView) {
            this.amnesiaView = new App.UserAmnesiaView({user: this.user});
            this.amnesiaView.on('hide', this.navigateToPrevious, this);
        }
        this.amnesiaView.email = email || '';
        this.amnesiaView.slideDown();
    },

    navigateToPrevious: function() {
        this.navigate('/');
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