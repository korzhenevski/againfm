var App = App || {};

App.setup = function(bootstrap) {
    App.cometfm = new Comet(App.config.comet_server);

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

    App.radio = new App.Radio();
    App.controls = new App.RadioControlsView();

    App.player = new App.Player();
    if (App.config.spectrum) {
        App.spectrum = new App.Spectrum();
    }

    App.now = new App.RadioNowView({player: App.player});

    App.filters.reset(bootstrap.categories);
    App.filters.unshift(new App.HistoryFilter());
    App.filters.unshift(new App.HomeFilter());

    App.playlist.reset(bootstrap.playlist);

    App.filters.on('select', function(filter){
        var role = filter.get('role');
        if (role == 'history') {
            App.playlist.reset(App.playHistory.toJSON());
        } else {
            App.playlist.fetchById(filter.id);
        }
    });

    App.radio.on('change_stream', function(){
        setFavicon(App.config.static_url + 'i/favicon_play.ico');
    });

    App.player.on('play', function(){
        setFavicon(App.config.static_url + 'i/favicon_play.ico');
    });

    App.player.on('paused', function(){
        setFavicon(App.config.static_url + 'i/favicon.ico');
    });

    App.playlist.on('change_station', function(station) {
        App.radio.setStation(station);
    });

    App.footer = new App.FooterView();
};

App.start = function() {
    //App.player.embedTo('player-container', {volume: App.controls.volume});
};