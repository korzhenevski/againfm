var afm = angular.module('afm', ['ngResource', 'ngCookies']);

afm.config(function($routeProvider, $locationProvider){
    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!');
    //$routeProvider.when('/radio/:radioId', {controller: 'StationCtrl', template: ''}).otherwise({redirectTo: '/'});
});

afm.directive('radioCursor', function($rootScope){
    return {
        restrict: 'C',
        link: function($scope, element, attrs) {
            $rootScope.$on('playlist.currentElement', function(ev, el){
                var left = el.prop('offsetLeft') + 25;
                element.css('left', left + 'px');
            })
        }
    };
});

afm.directive('stationLink', function($rootScope){
    return {
        restrict: 'C',
        link: function($scope, element) {
            $scope.$watch('currentStation', function(){
                if (element.hasClass('selected')) {
                    $rootScope.$broadcast('playlist.currentElement', element);
                }
            })
        }
    };
});

afm.directive('volumeSlider', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            element.slider({
                min: 0,
                max: 1,
                value: attrs.value,
                step: 0.1,
                orientation: 'vertical',
                slide: function(event, ui) {
                    console.log(ui.value);
                }
            });
        }
    };
});

afm.factory('audio', function($document) {
    var audio = $document[0].createElement('audio');
    return audio;
});

// player.play('http://www.example.com/stream')
// player.stop()
// player.play()
afm.factory('player', function(audio, $cookieStore) {
    var player = {
        url: null,
        playing: false,
        volume: 0.7,

        play: function(url) {
            if (url) {
                player.url = url;
            }

            if (player.url) {
                audio.src = player.url;
                audio.play();
            }
            player.playing = true;
        },

        stop: function() {
            if (audio.src) {
                audio.src = null;
                audio.load();
            }
            player.playing = false;
        },

        loadVolume: function() {
            var volume = $cookieStore.get('volume');
            // громкость не установлена в куках - берем по умолчанию
            volume = angular.isUndefined(volume) ? player.volume : volume;
            player.setVolume(volume);
        },

        setVolume: function(volume) {
            volume = parseFloat(volume);
            audio.volume = volume;
            player.volume = volume;
            $cookieStore.put('volume', volume);
        }
    };

    player.loadVolume();

    audio.addEventListener('play', function(){
        player.playing = true;
    });

    angular.forEach(['ended', 'pause'], function(event){
        audio.addEventListener(event, function(){
            player.playing = false;
        });
    });

    return player;
});

afm.factory('favorites', function($cookieStore) {
    var favs = {
        stations: {},
        add: function(station) {
            favs.stations[station.id] = station;
            favs.save();
        },

        exists: function(id) {
            return favs.stations.hasOwnProperty(id);
        },

        remove: function(id) {
            if (favs.stations.hasOwnProperty(id)) {
                delete favs.stations[id];
            }
            favs.save();
        },

        clear: function() {
            favs.stations = {};
            favs.save();
        },

        save: function() {
            $cookieStore.put('favorites', favs.stations);
        }
    };

    favs.stations = $cookieStore.get('favorites') || {};
    return favs;
});

afm.factory('Auth', ['$http', function($http){
    var user = null;
    return {
        login: function(data) {
            return $http.post('/api/user/login', data).success(function(newUser){
                user = newUser;
            }).error(function(){
                    user = null;
                });
        },

        isLogged: function() {
            return !!user;
        },

        get: function() {
            return user;
        }
    };
}]);

afm.controller('LoginCtrl', function($scope, Auth){
    $scope.Auth = Auth;
    $scope.login = function() {
        Auth.login({
            login: $scope.login,
            password: $scope.password
        }).success(function(){
                $scope.$broadcast('logged');
            }).error(function(){

            });
    }
});

afm.controller('RadioCtrl', function($scope, $location, $resource, player, $http, favorites){
    $scope.filters = [
        {id: 'featured', title: 'Подборка'},
        {id: 'genre/trance', title: 'Транс'},
        {id: 'genre/house', title: 'Хауз'},
        {id: 'genre/dnb', title: 'Драм-н-бейс'},
        {id: 'genre/pop', title: 'Поп'},
        {id: 'genre/metal', title: 'Метал'},
        {id: 'genre/news', title: 'Новости'},
        {id: 'genre/chillout', title: 'Чилаут'}
    ];

    // TODO(outself): rename filter for anything for proper semantics
    $scope.player = player;
    $scope.playlist = [];
    $scope.currentFilter = null;

    $scope.currentStation = null;
    $scope.previousStation = null;

    var Playlist = $resource('/api/playlist/:filter');

    $scope.selectFilter = function(filter) {
        $scope.playlist = [];
        Playlist.get({filter: filter.id}, function(response){
            $scope.playlist = response.objects;
        });
        $scope.currentFilter = filter;
    };

    $scope.itemClass = function(filter, current) {
        var selected = current && current.id == filter.id;
        return {selected: selected};
    };

    $scope.selectFilter($scope.filters[0]);

    $scope.selectStation = function(station) {
        if (station != $scope.previousStation) {
            $scope.previousStation = $scope.currentStation;
        }
        $scope.currentStation = station;
        $http.get('/api/station/get/' + station.id).success(function(response){
            //$location.path('/radio/' + station.id);
            player.play(response.stream.url);
        });
    };

    $scope.isFaved = function() {
        return $scope.currentStation && $scope.favorites.exists($scope.currentStation.id);
    }

    $scope.selectRandomStation = function() {
        $http.get('/api/station/random').success(function(response){
            $scope.selectStation(response.station);
        });
    };

    $scope.fave = function() {
        var station = $scope.currentStation;
        if (!station) {
            return;
        }

        if (favorites.exists(station.id)) {
            favorites.remove(station.id);
        } else {
            favorites.add(station);
        }
    };

    $scope.volume = player.volume;
    $scope.setVolume = function() {
        player.setVolume($scope.volume);
    };

    // ---

    $scope.favorites = favorites;
});
