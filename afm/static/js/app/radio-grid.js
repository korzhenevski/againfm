/*display view
search view
playlist
filters*/

App.Playlist = App.Collection.extend({
    model: App.Station,
    _state: {},
    _query: 'default',

    initialize: function() {
        // track station for restore playlist current
        this.on('current_station_changed', function(station){
            this._state = {};
            this._state[this._query] = station;
        });
    },

    url: function() {
        return '/api/playlist/' + this._query;
    },

    setCurrentStation: function(station) {
        this.currentStation = station;
        this.trigger('current_station_changed', station);
    },

    getCurrentStation: function() {
        return this.currentStation;
    },

    next: function() {
        var index = this.indexOf(this.getCurrentStation());
        if (index < 0 || ++index >= this.length) {
            index = 0;
        }
        this.setCurrentStation(this.at(index));
    },

    previous: function() {
        var index = this.indexOf(this.getCurrentStation());
        if (index < 0 || --index < 0) {
            index = this.length - 1;
        }
        this.setCurrentStation(this.at(index));
    },

    fetchByQuery: function(query) {
        this._query = query;
        this.fetch().done(_.bind(function(){
            var snapshot = this._state[this._query];
            if (snapshot) {
                this.setCurrentStation(this.get(snapshot.currentStation.id));
            }
        }, this));
    }
});

