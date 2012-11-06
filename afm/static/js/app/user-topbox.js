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
        view.setHtml = _.bind(this.setHtml, this);
        view.render();
        this.$el.show().animate({marginTop: 0}, 'linear', _.bind(function(){
            this.$('form :text:first').focus();
            this.$('.close').show();
        }, this));
        this.view = view;
    },

    setHtml: function(html) {
        this.$el.html(html);
        this.showPlaceholder();
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
        this.validator.on('validate_field', function(node, error) {
            this.$('label.error').remove();
            if (error) {
                node.after($('<label class="error">').text(error));
            }
        }, this);

        this.validator.on('validate', function(valid) {
            this.$(':submit').prop('disabled', !valid);
        }, this);

        this.validator.validateForm();
        //this.$('input').bind('textchange', _.bind(this._removeErrorNotice, this));
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
    },

    // заменяется лейаут менеджером
    setHtml: function(html) {}
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
        this.setHtml($content);
    },

    submit: function() {
        this.ajaxButton(function(){
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
        this.setHtml($content);
    },

    submit: function() {
        this.ajaxButton(function(){
            return this.model.amnesia(this.serializeForm());
        });
        return false;
    },

    passwordReset: function(params) {
        // эвент обновляет контент плашки
        this.setHtml(this.result(params))
    },

    error: function(code) {
        this.showError(App.i18n('amnesia.error.' + code));
    }
});