var App = App || {};

App.User = App.Model.extend({
    url: '/api/user/',

    initialize: function() {
        this.settings = new App.UserSettings();
        this.on('logged', this.settings.fetch, this);
        this.on('logout', this.settings.clear, this);

        this.favorites = new App.UserFavorites();
        this.on('change:id', function() {
            if (this.isLogged()) {
                this.trigger('logged', this);
            }
        }, this);
    },

    login: function(login, password, options) {
        if (this.isLogged()) {
            return;
        }

        // TODO: упростить эту херню
        // гланды удаляются через жопу
        return this.callAction('login', {
            login: login,
            password: password
        }, {
            success: _.bind(function() {
                this.trigger('login', this);
            }, this),
            error: _.bind(function(model, resp) {
                var error = this.parseActionError(resp, [401, 400]);
                if (error) {
                    this.trigger('login.error', error);
                }
            }, this)
        });
    },

    logout: function() {
        if (!this.isLogged()) {
            return;
        }
        return this.destroy({
            action: 'logout',
            success: _.bind(function() {
                this.clear({
                    silent: true
                });
                this.trigger('logout', this);
            }, this)
        });
    },

    register: function(email, password) {
        if (this.isLogged()) {
            return;
        }
        return this.callAction('register', {
            email: email,
            password: password
        }, {
            success: _.bind(function() {
                this.trigger('register', this);
            }, this),
            error: _.bind(function(model, resp) {
                var error = this.parseActionError(resp, [400]);
                if (error) {
                    this.trigger('register.error', error);
                }
            }, this)
        });
    },

    passwordReset: function(email, options) {
        return this.callAction('password_reset', {
            email: email
        }, {
            success: (options.success || $.noop),
            error: _.bind(function(model, resp) {
                var error = this.parseActionError(resp, [400]);
                if (error) {
                    options.error && options.error(error);
                }
            }, this)
        });
    },

    changeName: function(name) {
        return this.callAction('change_name', {name: name});
    },

    changePassword: function(password) {
        return this.callAction('change_password', {password: password});
    },

    isLogged: function() {
        return this.has('id');
    }
});

App.UserLoginView = App.View.extend({
    el: 'form.login',
    events: {
        'submit': 'login',
        'click .register': 'showRegister',
        'click .amnesia': 'showAmnesia'
    },

    initialize: function(options) {
        _.bindAll(this, 'hideForm');
        var user = App.user;
        user.on('logged', this.hideForm);
        user.on('logout', this.show, this);
        user.on('login.error', function(error) {
            this.changeNotice(error, true).show();
        }, this);
        // if bootstrapped user already logged, don't show login form
        this.$el.toggle(!user.isLogged());
        this.$el.placeholder();
    },

    hideForm: function() {
        this.$el.hide();
        //this.$el.find(':text,:password').val('').trigger('change.jq_watermark');
        this.changeNotice('', false).hide();
    },

    changeNotice: function(text, isError) {
        var isError = isError || false;
        return this.$el.find('.notice p').text(text).parent().toggleClass('notice-error', isError);
    },

    showRegister: function() {
        this.trigger('register:show');
    },

    showAmnesia: function() {
        this.trigger('amnesia:show');
    },

    login: function() {
        var params = this.$el.serializeHash();
        if (!(params.login && params.password)) {
            return false;
        }
        App.user.login(params.login, params.password);
        return false;
    }
});

App.UserProfileView = App.View.extend({
    el: '.user-profile',
    events: {
        'click .logout': 'userLogout',
        'click .favorites': 'showFavorites',
        'click .settings': 'showSettings'
    },

    initialize: function(options) {
        this.user = App.user;
        if (this.user.isLogged()) {
            this.render();
        }
        this.user.on('logged', this.render, this);
        this.user.on('change:name change:email change:gravatar_hash', this.render, this);
        this.user.on('logout', this.hide, this);
    },

    render: function() {
        this.$el.html(render.user_profile({
            user: this.user.toJSON()
        })).show();
    },

    userLogout: function() {
        this.user.logout();
        return false;
    },

    showFavorites: function() {
        this.trigger('favorites:show');
        return false;
    },

    showSettings: function() {
        this.trigger('settings:show');
        return false;
    }
});

App.UserAreaView = App.View.extend({
    lazyViews: {
        'favorites': 'UserFavoritesView',
        'settings': 'UserSettingsView',
        'amnesia': 'UserAmnesiaView',
        'register': 'UserRegisterView'
    },
    _lazyViews: {},

    initialize: function(options) {
        this.user = App.user;
        this.userLogin = new App.UserLoginView();
        this.userLogin.on('register:show', this.lazyViewShow('register'));
        this.userLogin.on('amnesia:show', this.lazyViewShow('amnesia'));

        this.userProfile = new App.UserProfileView();
        this.userProfile.on('favorites:show', this.lazyViewShow('favorites'));
        this.userProfile.on('settings:show', this.lazyViewShow('settings'));
    },

    lazyViewShow: function(name) {
        return _.bind(function() {
            if (!this._lazyViews[name]) {
                this._lazyViews[name] = new App[this.lazyViews[name]];
            }
            this._lazyViews[name].showRender();
        }, this);
    }
});

App.UserFavorite = App.Model.extend({
    toggle: function() {
        this.set('is_deleted', !this.get('is_deleted'));
        this.callAction('toggle', {}, {});
    },

    isDeleted: function() {
        return this.get('is_deleted');
    }
});

App.UserFavorites = function() {
    this.initialize.apply(this, arguments);
}

App.UserFavorites.prototype = {
    url: '/api/user/favorites',
    favorite: {},

    fetch: function() {
        var params = {}, self = this;
        if (this.favorite && this.favorite.id) {
            params = {last_id: this.favorite.id};
        }
        $.getJSON(this.url, params).success(function(favorite){
            self.favorite = favorite;
        });
    },

    get: function() {
        return this.favorite;
    }
}

App.UserFavorites = App.Collection.extend({
    url: '/api/user/favorites',
    model: App.UserFavorite,

    getList: function() {
        /*
         var favorites = _.sortBy(this.toJSON(), function(obj) {
         return -obj.date;
         });

         var list = {};
         _.each(favorites, function(favorite) {
         if (!_.has(list, favorite._date)) {
         list[favorite._date] = [];
         }
         list[favorite._date].push(favorite);
         });
         return list;*/
        return {}
    }
});

App.UserPanelView = App.View.extend({
    el: '.user-panel',

    render: function() {
        this.$el.html(render.user_panel(this.getRender()));
        this.$el.find('.close').click(_.bind(this.hide, this));
        // TODO: bootstrap buttons
        this.$el.find('.btn').button();
        this.trigger('render');
    },

    hide: function() {
        this.trigger('panel:hide');
        this.$el.hide();
    },

    serialize: function(templateName, data, options) {
        options = options || {};
        var $content = render[templateName](data);
        return _.extend({
            title: $content.data('title'),
            content: $content.outerHtml()
        }, options);
    }
});

App.UserFavoritesView = App.UserPanelView.extend({
    initialize: function() {
        this.favorites = App.user.favorites;
        this.favorites.on('change remove', this.render, this);
        this.on('render', this.scrollSetup, this);
    },

    getRender: function() {
        //var favorites = this.favorites.getList();
        return this.serialize('user_favorites', {
            showHelp: !this.favorites.length
        });
    }
});

App.UserSettings = App.Model.extend({
    urlRoot: '/api/user/settings',

    isNightTime: function() {
        var hours = (new Date()).getHours();
        return hours >= 23 || hours <= 6;
    },

    hasNightVolumeLimit: function() {
        return this.isNightTime() && this.get('limit_night_volume');
    },

    trafficThrottling: function() {
        return !!this.get('throttle_traffic');
    }
});

App.UserSettingsView = App.UserPanelView.extend({
    events: {
        'click label': 'checkboxLabel',
        'click .checkbox': 'toggleCheckbox',
        'click .change-name': 'changeName',
        'click .password-reset': 'passwordReset',
        'click .show-password-change': 'showPasswordChange',
        'click .change-password': 'changePassword',
        'keyup .name': 'nameKeyup'
    },

    initialize: function() {
        var settings = App.user.settings;
        this.on('panel:hide', settings.save, settings);
        this.on('checkbox:change', settings.set, settings);
    },

    getRender: function() {
        var $content = render.user_settings();
        var user = App.user.toJSON();
        user['settings'] = {};
        _.each(App.user.settings.toJSON(), function(v, k) {
            user['settings'][k] = {name: k, value: v};
        });
        return this.serialize('user_settings', user);
    },

    showPasswordChange: function() {
        this.$el.find('.password-holder').hide();
        this.$el.find('.password-block').removeClass('hidden');
    },

    changePassword: function() {
        var $password = this.$el.find('input.password');
        var $button = this.$el.find('button.change-password');
        var password = $.trim($password.val());
        if (password) {
            $button.button('changing').disable();
            var act = App.user.changePassword(password).always(_.delay(function() {
                $button.button('reset').disable();
                $password.val('');
            }, 1000));
        }
        return false;
    },

    nameKeyup: function(e) {
        var $button = this.$el.find('button.change-name');
        var el = e.target;
        var $name = $(el);
        if (e.which == 13 && !$button.is(':disabled')) {
            this.changeName();
            return;
        }
        if (!$.data(el, 'lastval') || $.data(el, 'lastval') != $name.val()) {
            $.data(el, 'lastval', $name.val());
            $button.enable();
        }
    },

    changeName: function() {
        var $name = this.$el.find('input.name');
        var name = $.trim($name.val());
        var $button = this.$el.find('button.change-name');
        // check new name presence and difference
        if (name) {
            $button.button('changing').disable();
            $name.val(name).disable();
            var act = App.user.changeName(name).always(_.delay(function() {
                $button.button('reset');
                $name.enable();
            }, 1000));
        }
        return false;
    },

    passwordReset: function() {
        var $button = this.$el.find('.password-reset');
        $button.button('sending');
        (new App.User()).passwordReset(App.user.get('email'), {
            success: function(obj, response) {
                $button.replaceWith(render.password_reset(response));
            }
        }).fail(function() {
                $button.button('reset');
            });
    },

    checkboxLabel: function(e) {
        $(e.target).parents('li').find('.checkbox').click();
    },

    toggleCheckbox: function(e) {
        var $checkbox = $(e.target);
        var data = $checkbox.data();
        if (!_.has('disabled', data)) {
            var isChecked = !$checkbox.attr('data-checked');
            if (isChecked) {
                $checkbox.attr('data-checked', 'true');
            } else {
                $checkbox.removeAttr('data-checked');
            }
            this.trigger('checkbox:change', $checkbox.data('name'), isChecked);
        }
        return false;
    }
});

App.TopHolderView = App.View.extend({
    show: function() {
        this.$el.show().animate({
            'margin-top': 0
        }, 400, 'swing', _.bind(function() {
            this.$el.find(':text:first').focus();
            this.$el.find('.close-box').fadeIn();
        }, this));
    },

    hide: function() {
        this.$el.find('.close-box').fadeOut();
        this.$el.animate({
            'margin-top': this.$el.height() * -1
        }, 400, 'swing', _.bind(function() {
            this.$el.hide();
        }, this));
    },

    render: function() {
        var $el = render.top_holder(this.getRender()).prependTo('.wrapper');
        $el.placeholder();
        $el.find('.close').click(_.bind(this.hide, this));
        this.setElement($el);
        this._validator();
    },

    setupValidator: function(rules, messages) {
        this.validator = this.getForm()._validate({
            focusInvalid: false,
            onfocusout: false,
            ignoreTitle: true,
            errorPlacement: _.bind(function($error, $element) {
                this.getForm().find('.notice').hide();
                $element.parents('.form-input').remove('label[generated]').append($error);
            }, this),
            rules: rules,
            messages: messages
        });
    },

    getForm: function() {
        return this.$el.find('form:first');
    }
});

App.UserRegisterView = App.TopHolderView.extend({
    events: {
        'submit': 'register'
    },

    initialize: function(options) {
        this.render();
        var user = App.user;
        user.on('register', _.bind(function() {
            this.hide();
            this.validator.resetForm();
            // TODO: fix valid unhighlight in validator.resetForm
            this.getForm().find('.valid').removeClass('valid');
            //this.getForm().find(':text,:password').val('').trigger('change.jq_watermark');
        }, this));
        user.on('register.error', _.bind(function(rawErrors) {
            var errors = {};
            _.each(rawErrors, function(errorlist, field) {
                errors[field] = errorlist[0];
            });
            this.validator.showErrors(errors);
        }, this));
    },

    _validator: function() {
        this.setupValidator({
            email: {required: true, email: true},
            password: {required: true, minlength: 6}
        }, $.t('register.validation', {returnObjectTrees: true}));
    },

    getRender: function() {
        var $form = render.user_register();
        return {
            title: $form.data('title'),
            content: $form.outerHtml()
        };
    },

    register: function() {
        var params = this.getForm().serializeHash();
        App.user.register(params.email, params.password);
        return false;
    }
});

App.UserAmnesiaView = App.TopHolderView.extend({
    events: {
        'submit': 'amnesia'
    },

    initialize: function(options) {
        this.render();
        _.bindAll(this, 'passwordSent');
    },

    getRender: function() {
        var $form = render.user_amnesia();
        return {
            title: $form.data('title'),
            content: $form.outerHtml(),
            'class': 'amnesia-holder'
        };
    },

    amnesia: function() {
        var params = this.getForm().serializeHash();
        App.user.passwordReset(params.email, {
            success: this.passwordSent
            // TODO: error handling
        });
        return false;
    },

    passwordSent: function(user, response) {
        this.getForm().html(render.password_reset(response));
    },

    _validator: function() {
        this.setupValidator({
            email: {required: true, email: true}
        },
        $.t('amnesia.validation', {returnObjectTrees: true}));
    }
});
