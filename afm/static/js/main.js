window.App = {};

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
App.User = App.Model.extend({
    url: '/api/user/',

    initialize: function() {
        this.settings = new App.UserSettings();
        this.favorites = new App.UserFavorites();
        if (this.isLogged()) {
            this.favorites.fetch();
        }

        this.on('logged', function() {
            this.favorites.fetch();
            this.settings.fetch();
        }, this);

        this.on('change:id', function() {
            if (this.isLogged()) {
                this.trigger('logged', this);
            }
        }, this);

        this.on('logout', function() {
            this.favorites.reset();
            this.settings.clear();
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
        this.$el.find(':text,:password').val('').trigger('change.jq_watermark');
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

App.UserFavorites = App.Collection.extend({
    url: '/api/user/favorites',
    model: App.UserFavorite,

    initialize: function() {
        this.metaIds = {};
        this.on('reset', function() {
            this.metaIds = {};
            this.each(_.bind(function(obj) {
                this.metaIds[obj.get('meta_id')] = obj.id;
            }, this));
        });
        this.on('sync', function(obj) {
            this.metaIds[obj.get('meta_id')] = obj.id;
        });
        this.on('remove', function(obj) {
            delete this.metaIds[obj.get('meta_id')];
        });
    },

    exists: function(metaId) {
        return _.has(this.metaIds, metaId);
    },

    lookup: function(metaId) {
        var id = this.metaIds[metaId];
        return id ? this.get(id) : false;
    },

    getList: function() {
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
        return list;
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
    events: {
        'click td': 'changeState'
    },

    initialize: function() {
        this.favorites = App.user.favorites;
        this.favorites.on('change remove', this.render, this);
        this.on('render', this.scrollSetup, this);
    },

    changeState: function(e) {
        var favoriteId = $(e.target).parents('tr').data('id');
        this.favorites.get(favoriteId).toggle();
        this.favorites.trigger('favorite:toggle', favoriteId);
    },

    getRender: function() {
        var favorites = this.favorites.getList();
        return this.serialize('user_favorites', {
            favorites: favorites,
            showHelp: !this.favorites.length
        });
    },

    scrollSetup: function() {
        /*var scrollWrapper = this.$el.find('.scroller').get(0);
        var scroller = new iScroll(scrollWrapper, {
            hScroll: false
        });
        scroller.refresh();*/
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
        $(e.target).siblings('.checkbox').click();
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
        }, 500, _.bind(function() {
            this.$el.find(':text:first').focus();
            this.$el.find('.close-box').fadeIn();
        }, this));
    },

    hide: function() {
        this.$el.find('.close-box').fadeOut();
        this.$el.animate({
            'margin-top': this.$el.height() * -1
        }, 500, _.bind(function() {
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
        this.validator = this.getForm().validate({
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
            this.getForm().find(':text,:password').val('').trigger('change.jq_watermark');
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
        },
        {
            email: {
                required: gettext('enter email'),
                email: gettext('enter a valid email, please')
            },
            password: {
                required: gettext('choose a password'),
                minlength: gettext('at least six characters, please')
            }
        });
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
        {
            email: {
                required: gettext('enter email'),
                email: gettext('enter a valid email, please')
            }
        });
    }
});


App.Station = App.Model.extend({
    urlRoot: '/api/station/',
    defaults: {
        title: gettext('Untitled'),
        image: ''
    },
    // TODO: refactoring
    assign: function(model) {
        if (!model || model.id == this.id) {
            return;
        }
        this.set(model.attributes, {silent: true}).fetch();
        App.player.loadStreamById(model.id, true);
        this.trigger('assign', model);
    }
});

App.Playlist = App.Collection.extend({
    model: App.Station,
    url: '/api/playlist/',

    initialize: function(options) {
        this.id = 'featured';
        this.on('reset', this.restoreCurrentId, this);
        this.currentId = null;
        this.stateCache = {};
    },

    restoreCurrentId: function() {
        if (this.stateCache[this.id]) {
            this.currentId = this.stateCache[this.id];
            this.changeStation(this.currentId);
        }
    },

    next: function() {
        if (this.currentId) {
            var index = _.indexOf(this.models, this.get(this.currentId));
            if (index >= 0) {
                if (++index >= this.length) {
                    index = 0;
                }
            } else {
                index = 0;
            }
            this.changeStation(this.models[index].id);
        } else if (this.length) {
            this.changeStation(this.first().id);
        }
    },

    previous: function() {
        if (this.currentId) {
            var index = _.indexOf(this.models, this.get(this.currentId));
            if (index >= 0) {
                if (--index < 0) {
                    index = this.length - 1;
                }
            } else {
                index = 0;
            }
            this.changeStation(this.models[index].id);
        }
    },

    changeStation: function(id) {
        this.currentId = id;
        this.stateCache = {};
        this.stateCache[this.id] = this.currentId;
        this.trigger('change_station', this.get(id));
    },

    fetchById: function(id) {
        this.id = id;
        this.currentId = null;
        this.fetch({action: id});
    },

    comparator: function(model) {
        if (this.id.substr(0, 8) == 'category') {
            return model.get('order');
        }
        return model.id;
    }
});


App.Filter = App.Model.extend({
    defaults: {
        order: 10,
        role: 'category',
        hidden: false
    },
    show: function() {
        this.set('hidden', false);
    },
    select: function() {
        this.set('is_active', true);
        this.collection && this.collection.trigger('select', this);
    },
    unselect: function() {
        this.set('is_active', false);
    },
    toJSON: function() {
        var json = App.Model.prototype.toJSON.apply(this, arguments);
        return json;
    }
});

App.HomeFilter = App.Filter.extend({
    defaults: {
        order: 0,
        id: 'home',
        role: 'home',
        is_active: true
    }
});

App.HistoryFilter = App.Filter.extend({
    defaults: {
        order: 5,
        title: gettext('History'),
        id: 'history',
        role: 'history',
        hidden: true
    }
});

App.Filters = App.Collection.extend({
    model: App.Filter,
    url: '/api/playlist/categories/',
    comparator: function(model) {
        return model.get('order');
    },
    unselect: function() {
        return _.invoke(this.where({'is_active': true}), 'unselect');
    },
    getByRole: function(role) {
        return this.where({'role': role})[0];
    }
});

App.FilterItem = App.View.extend({
    events: {
        'click': 'select'
    },

    render: function() {
        this.setElement(render.filter_item(this.model.toJSON()));
        return this;
    },

    select: function() {
        this.model.collection.unselect();
        this.model.select();
    }
});

App.FiltersView = App.View.extend({
    el: '.filters',

    initialize: function(options) {
        this.filters = options.filters;
        this.filters.on('reset add change', this.render, this);
    },

    render: function() {
        var $list = this.$el.html('');
        this.filters.each(function(model) {
            if (!model.get('hidden')) {
                var filter = new App.FilterItem({model: model});
                $list.append(filter.render().el);
            }
        });
    }
});

App.RadioDisplayView = App.View.extend({
    el: '.radio-scale .scale-inner',
    events: {
        'click .station-link': 'stationClick'
    },

    initialize: function(options) {
        this.playlist = options.playlist;
        this.playlist.on('reset', this.toggleSliderVisibility, this);
        this.playlist.on('reset', this.render, this);
        this.playlist.on('change_station', this.select, this);
        /*this.iscroll = new iScroll('radio-scale', {
            'bounce': false,
            'momentum': false,
            'fadeScrollbar': false,
            'vScroll': false
        });*/
        this.setupScroll();
        this.$slider = $(options.slider);
    },

    setupScroll: function() {
        $('.radio-scroll').tinyscrollbar({axis: 'x'});
    },

    updateScroll: function() {
        $('.radio-scroll').tinyscrollbar_update();
    },

    render: function() {
        var i = 0,
            SLIDER_SIZE = 15,
            MAX_LINES = 4;

        var space = 150 - Math.round(Math.log(this.playlist.length) * 20);
        var maxLimit = Math.round(this.playlist.length * SLIDER_SIZE);
        var lines = 4;

        /*
         * Dynamic lines count
         * Math.round(this.playlist.length / (maxLimit / MAX_LINES)) + 1;
         * lines > MAX_LINES && (lines = MAX_LINES); lines || (lines = 1);
         **/
        for (var limits = [], linesHTML = [], i = 1; i <= lines; i++) {
            limits.push(0);
            linesHTML.push('<ul class="line' + i + '"></ul>');
        }

        this.$el.html(linesHTML.join(''));
        var $lines = this.$el.find('ul');
        for (spots = [], i = maxLimit; 0 <= i; i--) {
            spots.push(i * SLIDER_SIZE);
        }

        var i = 0;
        // assoc stationId -> $(display item)
        this.map = {};
        this.selectedIndex = 0;

        do {
            var spot = spots.pop(),
                m = _.min(limits),
                ml = _.indexOf(limits, m);
            if (!(0 < m && spot + 15 < m)) {
                var station = this.playlist.at(i++);
                if (!station) {
                    break;
                }
                var stationId = station.get('id');
                this.map[stationId] = $('<li>').html(station.escape('title')).attr({
                    'class': 'station-link',
                    'id': 'radio-station-' + station.id
                }).data('station-id', station.id).css('left', spot + (m ? 15 : 0)).appendTo($lines[ml]);
                var width = this.map[stationId].width();
                limits[ml] = spot + width + space;
            }
        } while (spots.length);

        $lines.each(function() {
            var $line = $(this);
            if (!$line.find('li').size()) {
                $line.addClass('empty-line');
            }
        });

        var scrollable = (_.max(limits) > $(window).width());
        if (scrollable) {
            this.$el.css('width', _.max(limits));
        } else {
            this.$el.css('width', '100%');
        }
        $('.radio-scale').toggleClass('movable', scrollable);
        this.updateScroll();

        // TODO: dirty hack
        if (this.playlist.currentId) {
            this.select(this.playlist.currentId);
        }
    },

    stationClick: function(e) {
        var $el = $(e.target);
        this.playlist.changeStation($el.data().stationId);
    },

    select: function(stationId, duration) {
        var $station = this.map[stationId.id ? stationId.id : stationId];
        if ($station) {
            this.$slider.show().animate({
                'left': $station.position().left + 13
            }, duration);
            this.$el.find('.active-station').removeClass('active-station');
            $station.addClass('active-station');
        }
    },

    hideSlider: function() {
        //this.$slider.animate({'left': -25}, 'fast');
        this.$slider.hide();
    },

    //  playlist context
    toggleSliderVisibility: function(playlist) {
        if (!playlist.currentId) {
            this.hideSlider();
        }
    }
});

App.Player = function() {
    this.initialize.apply(this, arguments);
};
_.extend(App.Player.prototype, Backbone.Events, {
    _player: null,
    _spectrum: null,
    fading: true,
    initialize: function() {
        var proxiedMethods = 'getVolume,mute,unmute,playStream,isPaused'.split(',');
        _.each(proxiedMethods, function(method) {
            if (!_.has(this, method)) {
                this[method] = _.bind(function() {
                    if (this._player) {
                        //  swf functions not support JS apply
                        //  wrap only functions without arguments
                        return this._player[method]();
                    }
                }, this);
            }
        }, this);
        var settings = App.user.settings;
        settings.on('change:fading_sound', function(obj, value) {
            this.fading = value;
        }, this);
        settings.on('change:throttle_traffic', function(obj, value) {
            this.throttleTraffic(value);
        }, this);
    },
    pauseStream: function() {
        this._player[this.fading ? 'pauseStreamWithFade' : 'pauseStream']();
    },
    stopStream: function() {
        this._player[this.fading ? 'stopStreamWithFade' : 'stopStream']();
    },
    loadStreamById: function(streamId, startPlay) {
        this._player.loadStreamById(streamId, startPlay);
    },
    setVolume: function(volume) {
        this._player.setVolume(volume);
    },
    throttleTraffic: function(throttle) {
        throttle = !!throttle;
        this._player.throttleTraffic(throttle);
    },
    embedTo: function(id, params) {
        var params = params || {};
        // Callback events
        // * ready - SWF ready
        // * error - radio load error
        swfobject.embedSWF(App.settings.STATIC_URL + 'swf/player.swf', id, 1, 1, '10', '', params, {
            'allowscriptaccess': 'always'
        }, {}, _.bind(this._onLoad, this));
    },
    _onLoad: function(e) {
        if (e.success) {
            this._player = e.ref;
        } else {
            console.error('player load fail');
        }
    },
    setSpectrum: function(spectrum) {
        this._spectrum = null;
        this._spectrum = spectrum;
    },
    getSpectrum: function() {
        return this._spectrum;
    }
});

App.Onair = App.Model.extend({});

App.RadioNow = App.Model.extend({
    defaults: {
        title: '',
        caption: '',
        image_url: ''
    }
});

App.RadioNowView = App.View.extend({
    el: '.radio-now',
    events: {
        'click .star': 'clickStar'
    },

    initialize: function(options) {
        _.bindAll(this, 'render', 'stationChanged', 'statusUpdate', 'setUnavailableRadio');

        this.player = options.player;
        this.player.on('error', this.setUnavailableRadio);

        this.content = new App.RadioNow();
        this.content.on('change', this.stopUnavailableTimer, this);
        this.content.on('change', this.render);

        this.station = options.station;
        this.station.on('change', this.stationChanged);

        var user = App.user;
        user.on('logged logout', this.render);
        user.favorites.on('favorite:toggle', this.render);

        this.statusUnavailableTimeout = 20000;
        this.imageNotfound = App.settings.STATIC_URL + 'i/display/notfound.png';
        this.imageLoading = App.settings.STATIC_URL + 'i/display/loading.png';
        preloadImage(this.imageNotfound, this.imageLoading);
    },

    stationChanged: function(station) {
        this.content.set({station_title: station.get('title')}, {silent: true});
        if (station.onair) {
            this.statusUpdate(station.onair);
        } else {
            this.content.set({
                title: gettext('Loading...'),
                caption: '',
                image_url: this.imageLoading,
                meta_id: null
            });
            this.startUnavailableTimer();
        }
        this.subscribeStatusUpdate(station, this.statusUpdate);
    },

    startUnavailableTimer: function() {
        this.stopUnavailableTimer();
        this._unavailableStatusTimer = setTimeout(_.bind(this.setUnavailableStatus, this), this.statusUnavailableTimeout);
    },

    stopUnavailableTimer: function() {
        if (this._unavailableStatusTimer) {
            clearTimeout(this._unavailableStatusTimer);
        }
    },

    subscribeStatusUpdate: function(station, onStatusUpdate) {
        var live = App.live;
        if (!live) {
            return;
        }
        var prevChannel = station.previous('channel');
        if (prevChannel) {
            live.unsubscribe(prevChannel);
        }
        var onair = station.onair;
        var cursor = (onair && onair.id) ? onair.id : 0;
        var channel = station.get('channel');
        live.setCursor(channel, cursor);
        live.subscribe(channel, onStatusUpdate);
        live.execute();
    },

    statusUpdate: function(status) {
        var data = {};
        if (!status.station_id || status.station_id == this.station.get('id')) {
            if (status.artist && status.trackname) {
                data.title = status.trackname;
                data.caption = status.artist;
            } else if (status.current_song) {
                data.title = status.current_song;
            }
        }
        data.image_url = status.image_url || this.imageNotfound;
        data.meta_id = status.meta_id || 0;
        this.content.set(data);
        return this;
    },

    getContent: function() {
        var content = this.content.toJSON();
        var user = App.user;
        if (user.isLogged()) {
            if (content.meta_id) {
                content.star_class = 'star';
                var favorite = user.favorites.lookup(content.meta_id);
                if (favorite && !favorite.isDeleted()) {
                    content.star_class += ' star-selected';
                }
            }
        }
        // skip image loading, if traffic throttling active
        if (user.settings.trafficThrottling()) {
            content.image_url = this.imageNotfound;
        }
        return content;
    },

    render: function() {
        if (!this.station.has('id')) {
            return;
        }
        var html = render.radio_now(this.getContent());
        this.$el.show().html(html);
        this.marqueeTitle();
    },

    marqueeTitle: function() {
        var $title = this.$el.find('.title-inner');
        var delta = $title.width() - $title.parent().width();
        if (delta > 5) {
            $title.stop();
            $title.parent().addClass('shadow');
            var marquee = function(delta) {
                    var data = {};
                    data['margin-left'] = delta < 0 ? 0 : -1 * delta;
                    $title.delay(1000).animate(data, Math.abs(delta) * 35, 'linear', function() {
                        marquee(-delta);
                    });
                }
            marquee(delta);
        } else {
            $title.parent().removeClass('shadow');
        }
    },

    setUnavailableStatus: function() {
        this.content.set({
            'title': gettext('Info unavailable'),
            'caption': '',
            'image_url': this.imageNotfound,
            'meta_id': null
        });
    },

    setUnavailableRadio: function() {
        this.content.set({
            'title': gettext('Radio unavailable'),
            'caption': '',
            'image_url': this.imageNotfound,
            'meta_id': null
        });
    },

    clickStar: function(e) {
        if (!App.user.isLogged()) {
            return false;
        }
        var $star = $(e.target);
        var meta_id = $star.data('metaId');
        var favorite = App.user.favorites.lookup(meta_id);
        if (favorite) {
            favorite.toggle();
            $star.toggleClass('star-selected');
        } else {
            App.user.favorites.create({meta_id: meta_id});
            $star.addClass('star-selected');
        }
        return false;
    }
});

App.RadioSpectrumView = App.View.extend({
    el: '#spectrum',
    initialize: function(options) {
        this.player = options.player;
        if (this.isSupported()) {
            this.ctx = this.el.getContext('2d');
            this.width = this.$el.width();
            this.height = this.$el.height();
            this.frameRender();
        } else {
            console.warn('Browser not support canvas. Spectrum render disabled.');
        }
    },

    isSupported: function() {
        return !!(this.el.getContext && this.el.getContext('2d'));
    },

    render: function() {
        var spectrum = this.player.getSpectrum();
        if (spectrum === null) {
            this.frameRender();
            return;
        }
        var spectrumSize = spectrum.length;
        var halfHeight = Math.floor(this.height / 2) - 20;
        this.ctx.clearRect(0, 0, this.width, this.height);
        if (!spectrumSize) {
            this.drawEmptyLine('#f3f3f3', 1, halfHeight);
            this.frameRender();
            return;
        }

        var chunk = Math.floor(spectrumSize / 3);
        var step = Math.round(this.width / chunk);

        $.each(['#d86b26', '#d72f2e', '#0f9ac5'], _.bind(function(c, color) {
            var points = [];
            var lim = chunk * (c + 1);
            var pos = 0;
            for (var i = (chunk * c); i < lim; i++) {
                var val = halfHeight + Math.round(spectrum[i] * halfHeight);
                if (val > this.height) {
                    val = this.height;
                }
                if (val < 0) {
                    val = 0;
                }
                points.push([pos, val]);
                pos += step;
            }
            this.drawCurvyLine(points, 0.5, color, 2);
            points = null;
        }, this));
        spectrum = null;

        this.frameRender();
    },

    drawEmptyLine: function(color, linewidth, height) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = linewidth;

        this.ctx.shadowColor = color;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        this.ctx.shadowBlur = 5;

        this.ctx.moveTo(0, height);
        this.ctx.lineTo(this.width, height);
        this.ctx.stroke();
    },

    drawCurvyLine: function(coords, factor, color, linewidth) {
        var ctx = this.ctx;
        ctx.beginPath();

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 5;

        ctx.strokeStyle = color;
        ctx.lineWidth = linewidth;
        var len = coords.length;

        for (var i = 0; i < len; ++i) {
            if (coords[i] && typeof(coords[i][1]) == 'number' && coords[i + 1] && typeof(coords[i + 1][1]) == 'number') {
                var coordX = coords[i][0];
                var coordY = coords[i][1];
                var nextX = coords[i + 1][0];
                var nextY = coords[i + 1][1];
                var prevX = coords[i - 1] ? coords[i - 1][0] : null;
                var prevY = coords[i - 1] ? coords[i - 1][1] : null;
                var offsetX = (coords[i + 1][0] - coords[i][0]) * factor;
                var offsetY = (coords[i + 1][1] - coords[i][1]) * factor;

                if (i == 0) {
                    ctx.moveTo(coordX, coordY);
                    ctx.lineTo(nextX - offsetX, nextY - offsetY);
                } else if (nextY == null) {
                    ctx.lineTo(coordX, coordY);
                } else if (prevY == null) {
                    ctx.moveTo(coordX, coordY);
                } else if (coordY == null) {
                    ctx.moveTo(nextX, nextY);
                } else {
                    ctx.quadraticCurveTo(coordX, coordY, coordX + offsetX, coordY + offsetY);
                    if (nextY) {
                        ctx.lineTo(nextX - offsetX, nextY - offsetY);
                    } else {
                        ctx.lineTo(coordX, coordY);
                    }
                }
            } else if (typeof(coords[i][1]) == 'number') {
                ctx.lineTo(coords[i][0], coords[i][1]);
            }
        }
        ctx.stroke();
    },

    frameRender: function() {
        requestAnimFrame(_.bind(this.render, this));
    }
});

App.RadioControlsView = App.View.extend({
    el: '.radio-controls',
    events: {
        'click .radio-control-play': 'controlPlay',
        'click .radio-control-prev': 'controlPrevious',
        'click .radio-control-next': 'controlNext',
        'click .radio-control-sound': 'controlSound'
    },

    initialize: function() {
        var vol = $.cookie('volume');
        var isNightLimit = App.user.settings.hasNightVolumeLimit();
        if (vol !== null) {
            this.volume = isNightLimit ? App.settings.NIGHT_VOLUME : vol;
        } else {
            this.volume = App.settings.DEFAULT_VOLUME;
        }
        this.$el.find('.radio-control-sound').toggleClass('radio-control-sound-off', this.volume === 0).show();
        this.isMuted = false;
        this.render();
    },

    render: function() {
        this.$el.find('.radio-control-slider').slider({
            range: 'min',
            value: this.volume,
            slide: _.throttle(_.bind(this.changeVolume, this), 100)
        });
        this.$el.find('.radio-control-sound');
    },

    changeVolume: function(e, ui) {
        var volume = ui.value;
        var $sound = this.$el.find('.radio-control-sound');
        if (volume) {
            $sound.removeClass('radio-control-sound-off');
            this.isMuted = false;
        } else {
            $sound.addClass('radio-control-sound-off');
        }
        this.setVolume(volume);
    },

    setVolume: function(volume) {
        this.volume = volume;
        App.player.setVolume(this.volume);
        $.cookie('volume', this.volume);
    },

    controlPlay: function() {
        if (App.player.isPaused()) {
            App.player.playStream();
        } else {
            App.player.pauseStream();
        }
        return false;
    },

    controlPrevious: function() {
        App.playlist.previous();
        return false;
    },

    controlNext: function() {
        App.playlist.next();
        return false;
    },

    controlSound: function() {
        var $control = this.$el.find('.radio-control-sound');
        var $slider = this.$el.find('.radio-control-slider');
        if ($control.is('.radio-control-sound-off')) {
            if (this.isMuted) {
                $control.removeClass('radio-control-sound-off');
                App.player.unmute();
                $slider.slider('value', App.player.getVolume());
                $.cookie('volume', App.player.getVolume());
                this.isMuted = false;
            }
        } else {
            App.player.mute();
            $slider.slider('value', 0);
            $.cookie('volume', 0);
            $control.addClass('radio-control-sound-off');
            this.isMuted = true;
        }
    }
});

App.AboutView = App.View.extend({
    el: '.radio-scale .about-box',

    render: function() {
        this.$el.siblings().hide();
        this.$el.html(render.about());
    },

    close: function() {
        this.$el.hide();
        this.$el.siblings().show();
    }
});

App.TosView = App.UserPanelView.extend({
    getRender: function() {
        return this.serialize('tos');
    }
});

App.PlayHistory = App.Collection.extend({
    model: App.Station,
    initialize: function() {
        App.current_station.on('assign', this.add, this);
    }
});

App.FooterView = App.View.extend({
    el: '.footer',
    events: {
        'click .about': 'showAbout',
        'click .tos': 'showTos'
    },

    showAbout: function() {
        if (!this.about) {
            this.about = new App.AboutView();
            App.filters.on('select', this.about.close, this.about);
        }
        App.filters.unselect();
        this.about.showRender();
    },

    showTos: function() {
        if (!this.tos) {
            this.tos = new App.TosView();
        }
        this.tos.showRender();
    }
});

App.Router = Backbone.Router.extend({
    routes: {
        'station/:id': 'station'
    },

    station: function(id) {
        var station = App.playlist.get(id);
        if (station) {
            App.current_station.set(station.attributes, {silent: true}).fetch();
            App.player.loadStreamById(station.id, true);
        }
    }
});

App.setup = function(bootstrap) {
    App.filters = new App.Filters();
    App.playlist = new App.Playlist();
    App.user = new App.User(bootstrap.user);
    App.user.settings = new App.UserSettings(bootstrap.settings || {});

    App.userArea = new App.UserAreaView();

    // group "radio" views to Radio view
    App.filtersView = new App.FiltersView({
        filters: App.filters,
        playlist: App.playlist
    });

    App.display = new App.RadioDisplayView({
        playlist: App.playlist,
        slider: $('.scale-slider')
    });

    App.current_station = new App.Station();
    App.controls = new App.RadioControlsView();

    App.player = new App.Player();

    App.spectrum = new App.RadioSpectrumView({
        player: App.player
    });

    $.getCachedScript(App.settings.STATIC_URL + 'js/swfobject.js').done(function() {
        App.player.embedTo('player-container', {
            volume: App.controls.volume,
            process_spectrum: App.spectrum.isSupported(),
            throttle_traffic: App.user.settings.trafficThrottling()
        });
    });


    App.now = new App.RadioNowView({
        station: App.current_station,
        player: App.player
    });

    App.filters.reset(bootstrap.categories || {});
    App.filters.unshift(new App.HistoryFilter());
    App.filters.unshift(new App.HomeFilter());

    App.playlist.reset(bootstrap.playlist || {});
    App.playHistory = new App.PlayHistory();
    App.playHistory.on('add change', function(history){
        if (this.length > 1) {
            App.filters.getByRole('history').show();
        }
    });
    App.filters.on('select', function(filter){
        var role = filter.get('role');
        if (role == 'history') {
            App.playlist.reset(App.playHistory.toJSON());
        } else {
            App.playlist.fetchById(filter.id);
        }
    });
 
    App.playlist.on('change_station', function(station) {
        App.current_station.assign(station);
    });

    App.footer = new App.FooterView();

    /*
    App.router = new App.Router();
    Backbone.history.start({pushState: true});*/
};
