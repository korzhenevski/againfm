
/**
 * + Треклист - авторизованный и не очень
 * + авторизованное Избранное
 * + Добавление удаление Избранное
 * + Ошибки в модальных окнах: пользователь уже существует, etc...
 * / http-interceptor для json ошибок
 * + фильтрация через контроллер - в скопе уже отфильтрованный список (треки, плейлист)
 * Регулятор громкости
 * [X] модального окна - проверка предудущего роута, modal == true: возврат на главную
 * настройки пользователя
 * отображение имени в хедере, если есть в настройках
 * логин через вконтакте
 * + Поиск по треклисту
 * + ссылки на радио
 * + добавление удаление треков
 * + подгрузка трека (comet)
 * баг с ховером отмены удаления трека
 * Прокидывание в регистрацию избранного и треклиста
 * Проигрывание через флеш
 * PIE для IE
 */
var afm = angular.module('afm', ['ngResource', 'ngCookies']);

afm.value('bootstrapUser', null);
afm.constant('cometUrl', 'http://comet.againfm.local/');
afm.service('comet', Comet);

afm.config(function($routeProvider, $locationProvider){
    // TODO: add forEach
    $routeProvider.when('/login', {controller: 'LoginCtrl', templateUrl: '/login.html', modal: true});
    $routeProvider.when('/signup', {controller: 'SignupCtrl', templateUrl: '/signup.html', modal: true});
    $routeProvider.when('/amnesia', {controller: 'AmnesiaCtrl', templateUrl: '/amnesia.html', modal: true});
    // controller don't execute without "template" attr
    $routeProvider.when('/radio/:stationId', {template:'<div></div>', controller: 'RadioStationCtrl', resolve: {
        station: function($route, $http) {
            // use $route instead $routeParams
            // https://github.com/angular/angular.js/issues/1289
            var stationId = $route.current.params.stationId;
            return $http.get('/api/station/' + stationId).then(function(req){
                return req.data.station;
            });
        }
    }});
    $routeProvider.otherwise({redirectTo: '/'});
    $locationProvider.html5Mode(true);
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
                var centerOffset = Math.round(el.prop('offsetWidth') / 2);
                // TODO: add random
                var left = el.prop('offsetLeft') + centerOffset;
                element.css('left', left + 'px');
            })
        }
    };
});

// TODO: add touch support
afm.directive('volumeHandle', function($rootScope, $document){
    return {
        restrict: 'CA',
        scope: {
            volume: '=',
            onChange: '&'
        },
        link: function($scope, element, attrs) {
            var startValue;
            var startPosition;
            var max = parseFloat(attrs.max);
            var volumeLine = element.parent();
            var handlerHeight = element.prop('offsetHeight');
            var lineHeight = volumeLine.prop('offsetHeight') - handlerHeight;

            updateValue($scope.volume);

            volumeLine.bind('click', function(e){
                // TODO: offsetY available only on Chrome, support other browsers
                updateValue(posToValue(e.offsetY - handlerHeight / 2));
            });

            element.bind('click', function(e){
                e.stopPropagation();
            });

            element.bind('mousedown', function(e){
                startPosition = e.pageY;
                startValue = $scope.volume;
            });

            $document.bind('mousemove', function(e){
                if (!startPosition) {
                    return;
                }
                var delta = e.pageY - startPosition;
                var value = startValue + ((delta / lineHeight) * max);
                updateValue(value);
            });

            $document.bind('mouseup', function(){
                startPosition = startValue = null;
            });

            function updateValue(value) {
                value = parseFloat(value);
                value = Math.round(clamp(value, 0, max) * 10) / 10;
                var pos = 0;
                if (value > 0) {
                    pos = (value / max) * lineHeight;
                }
                element.css('top', Math.round(pos) + 'px');
                $scope.volume = value;
                // TODO: investigation - fix apply already in progress
                // TODO: fix this shit
                if (!$rootScope.$$phase) { $rootScope.$apply(); }
                $scope.onChange();
            }

            function clamp(value, min, max) {
                if (value <= min) { value = min; }
                if (value >= max) { value = max; }
                return value;
            }

            function posToValue(pos) {
                var delta = clamp(pos, 0, lineHeight);
                return delta ? (delta / lineHeight) * (max) : 0;
            }
        }
    };
});

afm.directive('stationLink', function($rootScope, radio){
    return {
        restrict: 'C',
        link: function($scope, element) {
            element.bind('click', function(){
                $rootScope.$broadcast('playlist.currentElement', element);
            });

            // TODO: check watch performance
            $scope.$watch('currentStation()', function(){
                if (element.hasClass('selected')) {
                    $rootScope.$broadcast('playlist.currentElement', element);
                }
            });
        }
    };
});

// TODO: prevent body scroll
afm.directive('tracksBox', function($document){
    return {
        restrict: 'C',
        link: function($scope, element) {
            $scope.visible = false;
            $scope.$on('tracks.toggle', function(){
                $scope.visible = !$scope.visible;
            });

            element.bind('click', function(e){
                e.stopPropagation();
            });

//            element.find('.tracks-inner').bind('mousewheel DOMMouseScroll', function(e){
//                var delta = e.wheelDelta || -e.detail;
//                this.scrollTop += ( delta < 0 ? 1 : -1 ) * 30;
//                e.preventDefault();
//            });

            // close on body click
            $document.bind('click', function(e){
                $scope.$apply(function(){
                    $scope.visible = false;
                });
            });

            // close on escape
            $document.bind('keyup', function(e){
                if (e.keyCode == 27) {
                    $scope.$apply(function(){
                        $scope.visible = false;
                    });
                }
            });
        }
    }
});

afm.directive('modal', function($rootScope, $window){
    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
            title: '@'
        },
        require: '^modalBox',
        template: '<div class="modal"><h1 class="header">{{ title }} <i class="close"></i></h1><div ng-transclude></div></div>',
        link: function(scope, element, attrs, controller) {
            element.addClass('modal-' + attrs.role);
            element.find('i').bind('click', function(){
                $window.history.back();
            });
        }
    };
});

afm.directive('modalBox', function($route, $rootScope, $location){
    return {
        restrict: 'AC',
        controller: function() {
            /*var that = this;
            this.location = null;

            $rootScope.$on('$routeChangeSuccess', function(target, current, prev){
                if ($route.current && !$route.current.modal) {

                }
                console.log(prev);
            });*/
        },
        link: function(scope, element, attrs, controller) {
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
        },

        get: function() {
            return user;
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

afm.factory('UserTrack', function($http){
    return {
        add: function(id) {
            $http.post('/api/user/tracks/add', {track_id: id});
        },

        remove: function(id) {
            $http.post('/api/user/tracks/remove', {track_id: id});
        },

        list: function(cb) {
            $http.get('/api/user/tracks').success(function(response){
                cb(response['objects']);
            });
        }
    }
});

afm.factory('passErrorToScope', function(){
    return function($scope) {
        return function(response, status_code) {
            var error = {};
            if (angular.isObject(response) && response.error) {
                error.reason = response.error;
            }
            error.code = status_code;
            $scope.error = error;
        };
    }
});

afm.controller('LoginCtrl', function($scope, $location, currentUser, User, passErrorToScope){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.form = {
        login: 'test@testing.com',
        password: 'password'
    };

    // TODO: move to form controller
    $scope.$watch('form', function(){
        $scope.error = null;
    }, true);

    $scope.auth = function() {
        $scope.error = null;

        User.login($scope.form).success(function(response){
            currentUser.update(response.user);
            $location.path('/');
        }).error(passErrorToScope($scope));
    };
});

afm.controller('SignupCtrl', function($scope, $location, currentUser, User, passErrorToScope){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.form = {};

    $scope.$watch('form', function(){
        $scope.error = null;
    }, true);

    $scope.signup = function() {
        $scope.error = null;

        User.signup($scope.form).success(function(response){
            currentUser.update(response.user);
            $location.path('/');
        }).error(passErrorToScope($scope));
    };
});

afm.controller('AmnesiaCtrl', function($scope, $location, currentUser, User, passErrorToScope){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.form = {};

    $scope.$watch('form', function(){
        $scope.error = null;
    }, true);

    $scope.amnesia = function() {

        $scope.error = null;
        User.amnesia($scope.form).success(function(result){
            $scope.result = result;
        }).error(passErrorToScope($scope));
    };
});

/**
 * Контролер плейлиста
 */
afm.controller('PlaylistCtrl', function($scope, $filter, Playlist, radio){
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
    // ids list for fast lookup
    var playlistIds = [];

    $scope.selectFilter = function(filter) {
        $scope.playlist = [];
        $scope.currentFilter = filter;

        Playlist.get({filter: filter.id}, function(response){
            $scope.playlist = response.objects;
            playlistIds = [];
            angular.forEach(response.objects, function(station){
                playlistIds.push(station.id);
            });
        });
    };

    $scope.showCursor = function() {
        if ($scope.searchQuery || !radio.isStationLoaded()) {
            return false;
        }
        return playlistIds.indexOf(radio.getStation().id) >= 0;
    };

    $scope.selectFilter($scope.filters[0]);
});

afm.factory('radio', function($rootScope){
    var currentStation = null;
    var previousStation = null;

    function selectStation(station) {
        // TODO: check this WTF...
        if (station != previousStation) {
            previousStation = currentStation;
        }
        currentStation = station;
        $rootScope.$broadcast('stationChanged', currentStation, previousStation);
    }

    return {
        getStation: function() {
            return currentStation;
        },
        previousStation: function() {
            return previousStation;
        },
        isStationLoaded: function() {
            return currentStation && currentStation.id;
        },
        selectStation: selectStation
    };
});

afm.controller('RadioStationCtrl', function(station, radio, player){
    // prevent double load station, sound cause flickering
    if (radio.isStationLoaded() && radio.getStation().id == station.id) {
        return;
    }
    radio.selectStation(station);
    player.play(station.stream.url);
});

afm.controller('RadioCtrl', function($scope, $http, $location, player, radio){
    $scope.player = player;

    $scope.currentStation = radio.getStation;
    $scope.previousStation = radio.previousStation;

    $scope.itemClass = function(filter, current) {
        var selected = current && current.id == filter.id;
        return {selected: selected};
    };

    $scope.selectStation = function(station) {
        $location.path('/radio/' + station.id);
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
    };

    $scope.remove = function(id) {
        favorites.remove(id);
    };
});

afm.factory('onair', function($rootScope, currentUser, radio, comet){
    var params = {};
    var track = null;

    $rootScope.$watch(function() { return currentUser.isLogged(); }, function(logged){
        if (logged) {
            params.user_id = currentUser.get().id;
        } else {
            delete params.user_id;
        }
        subscribe();
    });

    $rootScope.$watch(function() { return radio.getStation(); }, function(station){
        if (!angular.isObject(station)) {
            return;
        }
        params.channel = station.stream.channel;
        subscribe();
    }, true);

    function update(newTrack) {
        track = newTrack;
        // force convert to int, onair maybe return id as string
        if (angular.isString(track.id)) {
            track.id = parseInt(track.id, 10);
        }
        $rootScope.$apply();
    }

    function subscribe() {
        comet.unsubscribe();
        if (params.channel) {
            comet.subscribe(params, update);
        }
    }

    return {
        getTrack: function() {
            return track;
        }
    }
});

afm.controller('DisplayCtrl', function($rootScope, $scope, radio, currentUser, favorites, tracks, onair) {
    $scope.track = null;

    $rootScope.$watch(function(){ return onair.getTrack(); }, function(track){
        $scope.track = track;
    }, true);

    $scope.hasTrack = function() {
        var track = $scope.track;
        return track && track.id;
    };

    $scope.isTrackFaved = function() {
        if (! ($scope.track && $scope.track.id)) {
            return false;
        }
        if (currentUser.isLogged()) {
            return $scope.track.favorite;
        }
        return tracks.exists($scope.track.id);
    };

    $scope.faveTrack = function() {
        var track = $scope.track;
        if (tracks.exists(track.id)) {
            tracks.remove(track.id);
            track.favorite = false;
        } else {
            tracks.add(track.id, track.title);
            track.favorite = true;
        }
    };

    $scope.faveStation = function() {
        var station = radio.getStation();
        if (favorites.exists(station.id)) {
            favorites.remove(station.id);
        } else {
            favorites.add(station.id, station.title);
        }
    };

    $scope.isStationFaved = function() {
        var station = radio.getStation();
        if (!station) {
            return false;
        }
        return favorites.exists(station.id);
    };
});

afm.factory('tracks', function($rootScope, currentUser, storage, UserTrack) {
    var STORAGE_ID = 'tracks';
    var tracks = storage.get(STORAGE_ID) || {};

    // sync tracks to localstorage
    $rootScope.$watch(function() { return tracks; }, function(data){
        if (!currentUser.isLogged()) {
            storage.put(STORAGE_ID, data);
        }
    }, true);

    $rootScope.$watch(function() {
        return currentUser.isLogged();
    }, function(logged){
        if (logged) {
            storage.put(STORAGE_ID, {});
            UserTrack.list(function(objects){
                angular.forEach(objects, function(obj){
                    tracks[obj.id] = obj;
                });
            });
        } else {
            tracks = storage.get(STORAGE_ID);
        }
    });

    return {
        add: function(id, title) {
            var ts = +(new Date());
            tracks[id] = {id: id, title: title, ts: ts};
            if (currentUser.isLogged()) {
                UserTrack.add(id);
            }
        },

        restore: function(track) {
            tracks[track.id] = track;
            if (currentUser.isLogged()) {
                UserTrack.restore(track.id);
            }
        },

        remove: function(id) {
            if (tracks.hasOwnProperty(id)) {
                delete tracks[id];
            }
            if (currentUser.isLogged()) {
                UserTrack.remove(id);
            }
        },

        exists: function(id) {
            return !!tracks[id];
        },

        get: function() {
            var result = [];
            angular.forEach(tracks, function(obj){
                result.push(obj);
            });
            return result;
        }
    };
});

afm.controller('TracksCtrl', function($scope, $rootScope, $filter, currentUser, tracks){
    $scope.tracks = [];
    $scope.searchQuery = '';

    // reload tracks on user login/logout
    $rootScope.$watch(function() { return currentUser.isLogged(); }, function(){
        $scope.tracks = angular.copy(tracks.get());
        $scope.searchQuery = '';
    });

    $scope.haveTracks = function() {
        return !!$scope.tracks.length;
    };

    $scope.trackClass = function(track) {
        return {
            track: !track.removed,
            'track-removed': track.removed
        };
    };

    $scope.loadTracks = function() {
        $scope.tracks = angular.copy(tracks.get());
    };

    // reload tracks when user toggle box
    $rootScope.$on('tracks.toggle', function(){
        $scope.loadTracks();
    });

    $scope.getTracks = function() {
        if (!$scope.tracks.length || $scope.searchQuery) {
            $scope.loadTracks();
        }
        if ($scope.searchQuery) {
            return $filter('filter')(tracks.get(), $scope.searchQuery);
        }
        return $scope.tracks;
    };

    $scope.remove = function(track) {
        track.removed = true;
        tracks.remove(track.id);
    };

    $scope.restore = function(track) {
        delete track.removed;
        tracks.restore(track);
    }
});

afm.controller('MenuCtrl', function($scope, $rootScope){
    $scope.toggleTracks = function($event) {
        $rootScope.$broadcast('tracks.toggle');
        $event.stopPropagation();
    };
});
