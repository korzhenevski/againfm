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
