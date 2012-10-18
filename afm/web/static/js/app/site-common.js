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

    show: function(view) {
        if (this.view) {
            this.view.remove();
        }
        // прокидываем во вьюху ссылку на лейаут, путь делает что хочет :)
        view.layout = this;
        view.render();
        this.$el.css('marginTop', this.panelMarginTop()).show().animate({marginTop: 0}, 450, 'linear');
        this.view = view;
    },

    // значение верхнего отступа, что-бы контейнер ушел за пределы экрана
    panelMarginTop: function() {
        return -1 * (this.$el.outerHeight() + this.$el.position().top);
    },

    hide: function() {
        this.$el.animate({marginTop: this.panelMarginTop()}, 'linear', _.bind(function(){
            this.$el.hide();
            // убиваем после анимации, иначе при скрытии виден только пустой контейнер
            if (this.view) {
                this.view.remove();
                this.view = null;
            }
        }, this));
        this.trigger('hide');
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

    initialize: function() {
        this.setupValidator();
    },

    show: function() {
        this.$el.fadeIn();
    },

    hide: function() {
        this.$el.fadeOut(function(){
            // сбрасываем класс результата после скрытия
            $(this).removeClass('complete');
        });
        this.trigger('hide');
    },

    submit: function() {
        this.ajaxButton(function(){
            return $.post('/api/feedback', this.serializeForm()).always(_.bind(function(){
                // видимость элементов меняется через класс complete
                this.$el.addClass('complete');
                // после отправки, показав результат и чуток подождав, скрываем всю форму
                _.delay(_.bind(this.hide, this), 1400);
            }, this));
        }, 'sending');
        return false;
    },

    setupValidator: function() {
        this.validator = new FormValidator(this.$('form'), {
            rules: {
                text: {required: true},
                email: {required: true}
            }
        });
        this.validator.on('validate_field', function(field, error){
            field.toggleClass('error', !!error);
        });
        this.validator.on('validate', function(valid){
            this.$('form :submit').prop('disabled', !valid);
        }, this);
        this.validator.validateForm();
    }
});