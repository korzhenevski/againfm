/**
 * Представление панели с контентом.
 *
 * @type {function}
 */
App.PanelBox = App.View.extend({
    el: '.panel-box',
    events: {
        'click .close': 'hide'
    },
    mediator: App.mediator,

    initialize: function() {
        this.mediator.on('panelbox:show', this.show, this);
        this.mediator.on('panelbox:hide app:escape', this.hide, this);
        this.mediator.on('app:modal', function(view){
            if (view != 'panelbox') {
                this.hide();
            }
        }, this);
    },

    show: function(view, name) {
        if (this.name == name && this.$el.is(':visible')) {
            this.hide();
            return;
        }

        if (this.view) {
            this.view.remove();
        }
        this.name = name;
        // прокидываем во вьюху ссылку на лейаут, путь делает что хочет :)
        view.layout = this;
        view.render();
        this.$el.attr('id', 'panelbox-' + name);
        this.$el.css('top', $(window).height()).show().animate({top: 60}, 'linear');
        this.view = view;
        this.mediator.trigger('app:modal', 'panelbox');
    },

    hide: function() {
        this.$el.fadeOut(_.bind(function(){
            this.$el.hide();
            // убиваем после анимации, иначе при скрытии виден только пустой контейнер
            if (this.view) {
                this.view.remove();
                this.view = null;
            }
        }, this));
    }
});

App.PanelView = App.View.extend({
    render: function() {
        this.setElement(this.template());
        this.layout.$el.html(this.$el);
    },

    hide: function() {
        this.layout.$el.hide();
    }
});

App.AboutView = App.PanelView.extend({
    template: App.getTemplate('about')
});

App.TosView = App.PanelView.extend({
    template: App.getTemplate('tos')
});

App.FeedbackView = App.View.extend({
    el: '.feedback-box',
    events: {
        'submit form': 'submit',
        'click .close': 'hide'
    },
    mediator: App.mediator,

    initialize: function() {
        this.setupValidator();
        this.mediator.on('app:modal', function(view){
            if (view != 'feedback') {
                this.hide();
            }
        }, this);
        this.$email = this.$el.find('input[name=email]');
        // заполняем поле адреса от текущего юзера
        // в открытое окно ничего не пишем
        this.mediator.on('user:logged', function(user){
            if (!this.$el.is(':visible')) {
                this.$email.val(user.get('email'));
            }
        }, this);
        this.mediator.on('user:logout', function(){
            if (!this.$el.is(':visible')) {
                this.$email.val('');
            }
        }, this);
    },

    show: function() {
        this.$el.css('left', $('.feedback').position().left);
        this.$el.fadeIn();
        this.$el.find('textarea').focus();
        this.mediator.trigger('app:modal', 'feedback');
    },

    hide: function() {
        this.$el.fadeOut(function(){
            // сбрасываем класс результата после скрытия
            $(this).removeClass('complete');
        });
        // кидаем событие и роутер меняет url на предыдущий
        this.trigger('hide');
    },

    toggle: function() {
        if (this.$el.is(':visible')) {
            this.hide();
        } else {
            this.show();
        }
    },

    submit: function() {
        this.ajaxButton(function(){
            return $.post('/api/feedback', this.serializeForm()).always(_.bind(function(){
                // видимость элементов меняется через класс complete
                this.$el.addClass('complete');
                // после отправки, показав результат и чуток подождав, скрываем всю форму
                _.delay(_.bind(this.hide, this), 1000);
            }, this));
        }, 'sending');
        return false;
    },

    setupValidator: function() {
        var validator = new FormValidator(this.$('form'), {
            rules: {
                text: {required: true},
                email: {required: true}
            }
        });
        validator.on('validate_field', function(field, error){
            field.toggleClass('error', !!error);
        });
        validator.on('validate', function(valid){
            this.$('form :submit').prop('disabled', !valid);
        }, this);
        this.$('form :submit').prop('disabled', true);
    }
});

App.FooterView = App.View.extend({
    el: '.footer',
    events: {
        'click .about': 'showAbout',
        'click .tos': 'showTos',
        'click .feedback': 'showFeedback'
    },
    mediator: App.mediator,

    initialize: function() {
        this.feedbackView = new App.FeedbackView();
    },

    showAbout: function() {
        this.mediator.trigger('panelbox:show', new App.AboutView(), 'about');
    },

    showTos: function() {
        this.mediator.trigger('panelbox:show', new App.TosView(), 'tos');
    },

    showFeedback: function() {
        this.feedbackView.toggle();
    }
});

$(function(){
    App.footerView = new App.FooterView();
});