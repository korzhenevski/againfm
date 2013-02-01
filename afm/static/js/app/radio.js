var afm = angular.module('afm', ['ngResource']);

afm.controller('StationCtrl', function($scope, $routeParams){
    alert('radio');
});

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

afm.factory('Auth', ['$http', function($http){
    var user = null;
    var Auth = {
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
    return Auth;
}]);

afm.factory('Favorite', ['$resource', function($resource){
    return $resource('/api/user/favorites/:action', {}, {
        add: {method: 'POST', params: {action: 'add'}},
        remove: {method: 'POST', params: {action: 'remove'}}
    });
}]);

afm.directive('playPointer', function($rootScope){
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
            $scope.$watch('currentStation', function(currentStation){
                if (element.hasClass('selected')) {
                    $rootScope.$broadcast('playlist.currentElement', element);
                }
            })
        }
    };
});

afm.factory('Favorites', function(Auth, Favorite) {
    var favorites = {};

    return {
        add: function(station) {
            favorites[station.id] = station;
        },

        remove: function(station_id) {
            if (favorites.hasOwnProperty(station_id)) {
                delete favorites[station_id];
            }
        }
    };
});


afm.config(function($routeProvider, $locationProvider){
    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!');
    //$routeProvider.when('/radio/:radioId', {controller: 'StationCtrl', template: ''}).otherwise({redirectTo: '/'});
});

afm.factory('audio', function($document) {
    var audio = $document[0].createElement('audio');
    return audio;
});

// player.play('http://www.example.com/stream')
// player.stop()
// player.play()
afm.factory('player', function(audio) {
    var player = {
        url: null,
        playing: false,
        play: function(url) {
            if (url) {
                player.url = url;
            }

            if (false && player.url) {
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
        }
    };

    audio.addEventListener('play', function(){
        player.playing = true;
    });

    angular.forEach(['ended', 'pause'], function(event){
        audio.addEventListener(event, function(){
            player.playing = false;
        });
    })

    return player;
});

afm.controller('RadioCtrl', function($scope, $location, $resource, player, $http){
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
            $location.path('/radio/' + station.id);
            player.play(response.stream.url);
        });
    };

    $scope.selectRandomStation = function() {
        $http.get('/api/station/random').success(function(response){
            $scope.selectStation(response.station);
        });
    };

    // ---

    $scope.favorites = [{title: 'AH.FM'},{title: 'Afterhours.FM'},{title: 'Afterhours.FM'},{title: 'Afterhours.FM'}];
    $scope.addFavoriteStation = function(station) {

    };

    $scope.removeFavoriteStation = function(station) {
        var index = $scope.favorites.indexOf(station);
        $scope.favorites.splice(index, 1);
    };
});
