var App = App || {};

App.Router = Backbone.Router.extend({
    routes: {
        'station/:station_id': 'station'
    },
    mediator: App.mediator,
    station: null,

    initialize: function() {
        this.mediator.on('radio:station_changed', function(station){
            this.navigate('station/' + station.id);
            this.station = station;
        }, this);
    },

    station: function(station_id) {
        if (this.station && this.station.id == station_id) {
            this.mediator.trigger('app:set_station', this.station);
        } else {
            $.getJSON('/api/station/' + station_id, _.bind(function(station){
                this.station = station;
                this.mediator.trigger('app:set_station', station);
            }, this));
        }
    }
});