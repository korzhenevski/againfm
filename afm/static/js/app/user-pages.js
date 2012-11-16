App.UserFavoritesView = App.View.extend({
    template: App.getTemplate('user_favorites'),
    item_template: App.getTemplate('user_favorite'),
    label_template: App.getTemplate('favorites_label'),
    events: {
        'click .favorite': 'toggleFavorite',
        'click .station': 'playRadio'
    },
    mediator: App.mediator,

    initialize: function() {
        this.collection.on('reset', this.render, this);
    },

    playRadio: function(e) {
        var station = $(e.currentTarget).data();
        this.mediator.trigger('radio:play', station);
        return false;
    },

    toggleFavorite: function(e) {
        // пропускаем клики по ссылкам
        if ($(e.target).is('a')) {
            return;
        }

        var $el = $(e.currentTarget),
            template = this.item_template,
            model = this.collection.getByCid($el.data('cid'));

        model.toggleBookmark().always(function(){
            $el.replaceWith(template(model.toJSON()));
        });
        return false;
    },

    render: function() {
        var content = [];
        this.collection.each(function(model){
            content.unshift(this.item_template(model.toJSON()));
        }, this);
        this.setElement(this.template({content: content.join('')}));
        this.layout.$el.html(this.$el);
        var not_empty = !!this.collection.length;
        if (not_empty) {
            this.placeDateLabels();
        }
        this.layout.$el.toggleClass('panelbox-favorites', not_empty);
    },

    // поскольку список отсортирован убыванию времени создания
    // дата добавляется перед первым пунктом от списка дня
    placeDateLabels: function() {
        var group = {};
        this.layout.$('.favorite').each(function(){
            var groupKey = App.datediff(this.getAttribute('data-ts'));
            if (!_.has(group, groupKey)) {
                group[groupKey] = $(this);
            }
        });
        _.each(group, function($node, label){
            $node.before(this.label_template(label));
        }, this)
    },

    hide: function() {
        this.layout.hide();
    }
});


App.UserSettingsView = App.View.extend({
    template: App.getTemplate('user_settings'),

    events: {
        'click .setting': 'toggleSetting',
        'click .open-form': 'openForm',
        'submit .change-name': 'changeName'
    },

    validation: {
        change_name: {
            name: {required: true}
        },
        change_email: {
            email: {required: true, email: true},
            current_password: {required: true}
        },
        change_password: {
            password: {required: true, minlength: 6},
            current_password: {required: true}
        }
    },

    initialize: function() {
        this.model.on('logout', this.hide, this);
        this.disabled_settings = {spectrum: !Modernizr.canvas};
    },

    changeName: function() {
        var $form = $(e.currentTarget);
        this.changingButton($form, function(){
            return this.model.changeName(this.serializeForm($form));
        });
    },

    changingButton: function($form, callback) {
        var $submit = $form.find(':submit');
        $submit.button('changing');
        callback.apply(this).always(function(){
            $submit.button('reset').prop('disabled', true);
        });
    },

    submitChange: function(e){
        var $form = $(e.currentTarget),
            $submit = $form.find(':submit'),
            method = _.bind(this.model[$form.attr('action')], this.model);
        $submit.button('changing');
        method(this.serializeForm($form)).always(function(){
            $submit.button('reset').prop('disabled', true);
        });
        return false;
    },

    openForm: function(e) {
        $(e.currentTarget).parents('li').addClass('change');
    },

    toggleSetting: function(e) {
        var $button = $(e.currentTarget);
        var settings = _.clone(this.model.get('settings'));
        $button.button('toggle');
        settings[$button.data('name')] = $button.hasClass('active');
        this.model.set('settings', settings);
        this.model.saveSettings();
    },

    setupValidator: function($form) {
        var action = $form.attr('action');
        var validator = new FormValidator($form, {
            rules: this.validation[action]
        });
        validator.on('validate', function(valid){
            $form.find(':submit').prop('disabled', !valid);
        });
        validator.on('validate_field', function(field, error){
            field.toggleClass('error', !!error);
        });
        validator.validateForm();
    },

    render: function() {
        this.setElement(this.template({
            user: this.model.toJSON(),
            disabled_settings: this.disabled_settings
        }));
        _.each(this.$('form'), function(form){
            this.setupValidator($(form));
        }, this);
        this.layout.$el.html(this.$el);
    },

    hide: function() {
        this.layout.hide();
    }
});

Handlebars.registerHelper('setting', function(name) {
    var context = {
        name: name,
        disabled: _.has(this.disabled_settings, name) ? this.disabled_settings[name] : false,
        value: this.user.settings[name],
        label: App.i18n('settings.' + name + '.label'),
        notice: App.i18n('settings.' + name + '.notice', {'default': ''})
    };
    var html = App.getTemplate('user_settings_checkbox')(context);
    return new Handlebars.SafeString(html);
});
