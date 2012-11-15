var App = App || {};

App.RadioRouter = App.Router.extend({
    mediator: App.mediator,
    routes: {
        '!radio/:station_id': 'radio'
    },

    initialize: function() {
        this.station = null;
        this.mediator.on('radio:station_changed radio:play', function(station){
            if (!this.station || this.station != station) {
                this.station = station;
                this.navigate('!radio/' + station.id);
            }
        }, this);
    },

    radio: function(station_id) {
        $.getJSON('/api/station/' + station_id, _.bind(function(station){
            this.station = station;
            this.mediator.trigger('radio:play', station);
        }, this));
    }
});