xdescribe('radio playlist', function(){
    var playlist;
    beforeEach(function(){
        playlist = new App.Playlist([
            new App.Station({id: 1, title: 'Station 1'}),
            new App.Station({id: 2, title: 'Station 2'}),
            new App.Station({id: 3, title: 'Station 3'})
        ]);
        this.server = sinon.fakeServer.create();
    })

    afterEach(function() {
        this.server.restore();
    });

    it('first next select', function(){
        playlist.next();
        expect(playlist.getStation()).toEqual(playlist.first());
    });

    it('first previous select', function(){
        playlist.previous();
        expect(playlist.getStation()).toEqual(playlist.last());
    });

    it('navigation', function(){
        playlist.next();
        playlist.next();
        expect(playlist.getStation()).toEqual(playlist.at(1));
        playlist.previous();
        expect(playlist.getStation()).toEqual(playlist.first());
    });

    it('trigger station_changed event', function(){
        var callback = jasmine.createSpy();
        playlist.on('station_changed', callback);
        playlist.next();
        expect(callback).toHaveBeenCalledWith(playlist.getStation());
    });

    it('fetch by query and restore selected station', function(){
        this.server.respondWith('GET', '/api/playlist/tag/test',
            [200, {"Content-Type": "application/json"}, '{"objects":[{"id":1,"title":"t1"},{"id":2,"title":"t2"}]}']);
        this.server.respondWith('GET', '/api/playlist/tag/other-test',
            [200, {"Content-Type": "application/json"}, '{"objects":[{"id":3,"title":"t3"},{"id":4,"title":"t4"}]}']);

        playlist.fetchBySelector('tag/test');
        this.server.respond();
        expect(playlist.first().id).toEqual(1);
        playlist.setStation(playlist.last());

        playlist.fetchBySelector('tag/other-test');
        this.server.respond();
        expect(playlist.first().id).toEqual(3);

        playlist.fetchBySelector('tag/test');
        this.server.respond();
        expect(playlist.getStation().id).toEqual(playlist.last().id);
    });
});

describe('playlist selectors', function(){
    var selectors;
    beforeEach(function(){
        selectors = new App.Selectors([
            new App.Selector({selector: 'test'}),
            new App.Selector({selector: 'fest'}),
            new App.Selector({selector: 'breast'})
        ]);
    })

    it('select', function(){
        expect(selectors.first().get('active')).toEqual(false);
        selectors.first().select();
        expect(selectors.first().get('active')).toEqual(true);
        selectors.first().select();
    });
});