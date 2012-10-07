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

    login: function(login, password, options) {
        if (this.isLogged()) {
            return;
        }

        var self = this;
        $.post(this.url + 'login', {login: login, password: password}, function(user){
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

$(function(){
    App.user = new App.User();
})