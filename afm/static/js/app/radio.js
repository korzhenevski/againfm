
/**
 * + Треклист - авторизованный и не очень
 * Добавление удаление авторизованное Избранное
 * Ошибки в модальных окнах: пользователь уже существует, etc...
 * http-interceptor для json ошибок
 * + фильтрация через контроллер - в скопе уже отфильтрованный список (треки, плейлист)
 * Регулятор громкости
 * [X] модального окна - проверка предудущего роута, modal == true: возврат на главную
 * + Поиск по треклисту
 * Прокидывание в регистрацию избранного и треклиста
 * Проигрывание через флеш
 * PIE для IE
 */
var afm = angular.module('afm', ['ngResource', 'ngCookies']);

afm.value('bootstrapUser', null);

afm.config(function($routeProvider, $locationProvider, $httpProvider){
    $locationProvider.html5Mode(true);

    $routeProvider.when('/login', {controller: 'LoginCtrl', templateUrl: '/login.html', modal: true});
    $routeProvider.when('/signup', {controller: 'SignupCtrl', templateUrl: '/signup.html', modal: true});
    $routeProvider.when('/amnesia', {controller: 'AmnesiaCtrl', templateUrl: '/amnesia.html', modal: true});
    //$routeProvider.when('/radio/:stationId', {controller: function($routeParams){
    //    console.log($routeParams);
    //}});
    $routeProvider.otherwise({redirectTo: '/'});

    //  $httpProvider.responseInterceptors.push('apiHttpInterceptor');
});

afm.run(function($rootScope, $http, currentUser, bootstrapUser, User){
    $rootScope.currentUser = currentUser;
    $rootScope.logout = function() {
        if (currentUser.isLogged()) {
            currentUser.clear();
            User.logout();
        }
    };

    currentUser.update(bootstrapUser);
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

// TODO: prevent body scroll
afm.directive('tracksBox', function($document){
    return {
        restrict: 'C',
        link: function($scope, element) {
            /*$document.bind('click', function(e){
                // если это ссылка в хедере - пропускаем клик
                if (angular.element(e.target).hasClass('tracks-toggle')) {
                    return true;
                }

                $scope.$apply(function(){
                    $scope.showTracks = false;
                })
            });

            element.bind('click', function(e){
                e.stopPropagation();
                return false;
            });*/
            //element.bind('mousewheel DOMMouseScroll scroll', function(e){
            //    e.stopPropagation();
            //});
        }
    }
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
    };
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


afm.factory('apiHttpInterceptor', function($q){
    return function(promise) {
        return promise.then(function(response){
            console.log('response: ',response);
            return response;
        }, function(response){
            console.log('error response: '+response);
            return $q.reject(response);
        });
    };
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

afm.factory('storage', function($window, $cacheFactory, $log){
    try {
        // test localStorage
        var storage = $window['localStorage'];
        if (storage) {
            storage.setItem('key', 'value');
            storage.removeItem('key');
            return {
                put: function(key, value) {
                    storage.setItem(key, angular.toJson(value));
                },

                get: function(key) {
                    return angular.fromJson(storage.getItem(key));
                },

                remove: function(key) {
                    storage.removeItem(key);
                }
            }
        }
    } catch(e) {}
    // fallback
    $log.warn('localStorage not available. fallback used.');
    return $cacheFactory('storage');
});

afm.factory('currentUser', function($rootScope){
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

afm.factory('favorites', function($rootScope, currentUser, storage, UserFavorite) {
    var STORAGE_ID = 'favorites';
    var favorites = storage.get(STORAGE_ID) || {};

    // sync favorites to localstorage
    $rootScope.$watch(function() { return favorites; }, function(data){
        if (!currentUser.isLogged()) {
            storage.put(STORAGE_ID, data);
        }
    }, true);

    $rootScope.$watch(function() {
        return currentUser.isLogged();
    }, function(logged){
        console.log('User ' + (logged ? 'online' : 'offline'));
        if (logged) {
            // clean local favorites
            storage.put(STORAGE_ID, {});
            UserFavorite.list(function(objects){
                angular.forEach(objects, function(obj){
                    favorites[obj.id] = obj;
                });
            });
        } else {
            favorites = storage.get(STORAGE_ID);
        }
    });

    return {
        add: function(id, title) {
            var ts = +(new Date());
            favorites[id] = {id: id, title: title, ts: ts};
            if (currentUser.isLogged()) {
                UserFavorite.add(id);
            }
        },

        remove: function(id) {
            if (favorites.hasOwnProperty(id)) {
                delete favorites[id];
            }
            if (currentUser.isLogged()) {
                UserFavorite.remove(id);
            }
        },

        exists: function(id) {
            return !!favorites[id];
        },

        get: function() {
            var result = [];
            angular.forEach(favorites, function(obj){
                result.push(obj);
            });
            return result;
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

afm.factory('Station', function($http){
    return {
        get: function(stationId) {
            return $http.get('/api/station/' + stationId);
        }
    }
});

afm.factory('Playlist', function($resource){
    return $resource('/api/playlist/:filter');
});

afm.factory('UserFavorite', function($http){
    return {
        add: function(id) {
            $http.post('/api/user/favorites/add', {station_id: id});
        },

        remove: function(id) {
            $http.post('/api/user/favorites/remove', {station_id: id});
        },

        list: function(cb) {
            $http.get('/api/user/favorites').success(function(response){
                cb(response['objects']);
            });
        }
    }
});

afm.controller('LoginCtrl', function($scope, $location, currentUser, User){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.form = {
        login: 'test@testing.com',
        password: 'password'
    };

    $scope.auth = function() {
        $scope.error = null;
        User.login($scope.form).success(function(response){
            currentUser.update(response.user);
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

    $scope.form = {};
    $scope.signup = function() {
        $scope.error = null;
        User.signup($scope.form).success(function(response){
            currentUser.update(response.user);
            $location.path('/');
        }).error(function(){
                $scope.error = 'Error';
            });
    };
});

afm.controller('AmnesiaCtrl', function($scope, $location, currentUser, User){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.form = {};
    $scope.amnesia = function() {
        User.amnesia($scope.form).success(function(result){
            $scope.result = result;
        });
    };
});

/**
 * Контролер плейлиста
 */
afm.controller('PlaylistCtrl', function($scope, $filter, Playlist){
    // TODO(outself): rename filter for anything for proper semantics
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
    $scope.playlist = [];
    $scope.searchQuery = '';
    $scope.currentFilter = null;

    $scope.selectFilter = function(filter) {
        $scope.playlist = [];
        Playlist.get({filter: filter.id}, function(response){
            $scope.playlist = response.objects;
        });
        $scope.currentFilter = filter;
    };

    $scope.selectFilter($scope.filters[0]);
});

afm.controller('RadioCtrl', function($scope, $filter, player, $http){
    $scope.player = player;

    $scope.currentStation = null;
    $scope.previousStation = null;

    $scope.itemClass = function(filter, current) {
        var selected = current && current.id == filter.id;
        return {selected: selected};
    };

    $scope.selectStation = function(station) {
        if (station != $scope.previousStation) {
            $scope.previousStation = $scope.currentStation;
        }
        $scope.currentStation = station;
        $http.get('/api/station/get/' + station.id).success(function(response){
            player.play(response.stream.url);
        });
    };

    $scope.selectRandomStation = function() {
        $http.get('/api/station/random').success(function(response){
            $scope.selectStation(response.station);
        });
    };

    $scope.volume = player.volume;
    $scope.saveVolume = function() {
        player.setVolume($scope.volume);
    };
});

afm.controller('FavoritesCtrl', function($scope, $rootScope, favorites){
    $scope.getFavorites = function() {
        return favorites.get();
    }

    $scope.remove = function(id) {
        favorites.remove(id);
    };
});

afm.controller('DisplayCtrl', function($scope, currentUser, favorites){
    $scope.faveStation = function() {
        var station = $scope.currentStation;
        if (favorites.exists(station.id)) {
            favorites.remove(station.id);
        } else {
            favorites.add(station.id, station.title);
        }
    };

    $scope.isStationFaved = function() {
        if (!$scope.currentStation) {
            return false;
        }
        return favorites.exists($scope.currentStation.id);
    };
});

afm.controller('TracksCtrl', function($scope, $filter){
    $scope.tracks = [];
    $scope.searchQuery = '';

    $scope.getTracks = function() {
        return $filter('filter')($scope.tracks, $scope.searchQuery);
    };
});
