
/**
 * Треклист - авторизованный и не очень
 * Добавление удаление авторизованное Избранное
 * Ошибки в модальных окнах: пользователь уже существует, etc...
 * http-interceptor для json ошибок
 * фильтрация через контроллер - в скопе уже отфильтрованный список (треки, плейлист)
 * Регулятор громкости
 * [X] модального окна - проверка предудущего роута, modal == true: возврат на главную
 * Поиск по треклисту
 * Прокидывание в регистрацию избранного и треклиста
 * Проигрывание через флеш
 */
var afm = angular.module('afm', ['ngResource', 'ngCookies']);

afm.config(function($routeProvider, $locationProvider){
    $locationProvider.html5Mode(true);

    $routeProvider.when('/login', {controller: 'LoginCtrl', templateUrl: '/login.html', modal: true});
    $routeProvider.when('/signup', {controller: 'SignupCtrl', templateUrl: '/signup.html', modal: true});
    $routeProvider.when('/amnesia', {controller: 'AmnesiaCtrl', templateUrl: '/amnesia.html', modal: true});

    $routeProvider.otherwise({redirectTo: '/'});
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

afm.directive('modal', function($window){
    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
            title: '@'
        },
        template: '<div class="modal"><h1 class="header">{{ title }} <i class="close"></i></h1><div ng-transclude></div></div>',
        link: function(scope, element, attrs) {
            element.addClass('modal-' + attrs.role);
            element.find('i').bind('click', function(){
                $window.history.back();
            });
        }
    }
});

afm.directive('modalBox', function($route){
    return {
        restrict: 'AC',
        link: function(scope, element, attrs) {
            scope.$on('$routeChangeSuccess', update);
            update();

            function update() {
                var modal = $route.current && $route.current.modal;
                element.css('display', modal ? 'block' : 'none');
            }
        }
    }
});


afm.factory('audio', function($document) {
    var audio = $document[0].createElement('audio');
    return audio;
});


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

afm.factory('currentUser', function(){
    var user = null;
    return {
        update: function(userUpdate) {
            user = userUpdate;
        },

        clear: function() {
            user = null;
        },

        isLogged: function() {
            return !!user;
        }
    };
});

afm.factory('User', function($http){
    return {
        login: function(params) {
            return $http.post('/api/user/login', params);
        },

        signup: function(params) {
            return $http.post('/api/user/signup', params);
        },

        amnesia: function(params) {
            return $http.post('/api/user/amnesia', params);
        },

        logout: function() {
            return $http.post('/api/user/logout');
        },

        load: function() {
            return $http.post('/api/user');
        }
    };
});

afm.controller('LoginCtrl', function($scope, $location, currentUser, User){
    //$scope.login = 'test@testing.com';
    //$scope.password = 'password';

    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.user = {};
    $scope.auth = function() {
        $scope.error = null;
        User.login($scope.user).success(function(response){
            currentUser.update(response.user);
            $scope.$broadcast('userLogged');
            $location.path('/');
        }).error(function(){
            $scope.error = 'Error';
        });
    };
});

afm.controller('SignupCtrl', function($scope, $location, currentUser, User){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.user = {};
    $scope.signup = function() {
        $scope.error = null;
        User.signup($scope.user).success(function(response){
            currentUser.update(response.user);
            $scope.$broadcast('userLogged');
            $location.path('/');
        }).error(function(){
            $scope.error = 'Error';
        });
    };
});

afm.factory('apiHttpInterceptor', function($q){
    return function(promise) {
        return promise.then(function(response){
            return response;
        }, function(response){
            return $q.reject(response);
        });
    };
});


afm.controller('AmnesiaCtrl', function($scope, $location, currentUser, User){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.user = {};
    $scope.amnesia = function() {
        User.amnesia($scope.user).success(function(result){
            $scope.result = result;
        });
    };
});

afm.run(function($rootScope, $http, currentUser, User){
    $rootScope.currentUser = currentUser;
    $rootScope.logout = function() {
        if (currentUser.isLogged()) {
            currentUser.clear();
            User.logout();
        }
    };
    User.load().success(function(response){
        currentUser.update(response.user);
    });
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
    };

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
    $scope.saveVolume = function() {
        player.setVolume($scope.volume);
    };

    // ---

    $scope.favorites = favorites;
});

afm.controller('TracksCtrl', function($scope, $filter){
    $scope.searchQuery = '';
    $scope.tracks = [
        {title: 'Massive Attack – Paradise Circus', id: 1000},
        {title: 'Massive Attack – Paradise Circus', id: 1000},
        {title: 'Massive Attack – Paradise Circus', id: 1000, removed: true},
        {title: 'Massive Attack – Paradise Circus', id: 1000},
        {title: 'Massive Attack – Paradise Circus', id: 1000}
    ];

    $scope.tracksList = function() {
        return $filter('filter')($scope.tracks, $scope.searchQuery);
    };
});