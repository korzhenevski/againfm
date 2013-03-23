/**
 * настройки пользователя
 * отображение имени в хедере, если есть в настройках
 * логин через вконтакте
 * баг с ховером отмены удаления трека
 * Прокидывание в регистрацию избранного и треклиста
 * Проигрывание через флеш
 * PIE для IE
 */

(function(window, angular, Comet, undefined) {
'use strict';

var afm = angular.module('afm', ['ngResource', 'ngCookies']);

afm.value('bootstrapUser', null);
afm.service('comet', ['cometUrl', Comet]);

afm.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider){
    // TODO: add forEach
    $routeProvider.when('/login', {controller: 'LoginCtrl', templateUrl: '/login.html', modal: true});
    $routeProvider.when('/signup', {controller: 'SignupCtrl', templateUrl: '/signup.html', modal: true});
    $routeProvider.when('/amnesia', {controller: 'AmnesiaCtrl', templateUrl: '/amnesia.html', modal: true});
    $routeProvider.when('/feedback', {controller: 'FeedbackCtrl', templateUrl: '/feedback.html', modal: true});
    // controller don't execute without "template" attr
    $routeProvider.when('/listen/:id', {template:'<div></div>', controller: 'RadioStationCtrl', resolve: {
        station: ['$route', '$http', function($route, $http) {
            // use $route instead $routeParams
            // https://github.com/angular/angular.js/issues/1289
            var id = $route.current.params.id;
            return $http.get('/api/radio/' + id).then(function(req){
                return req.data;
            });
        }]
    }});
    //$routeProvider.otherwise({redirectTo: '/'});
    $locationProvider.html5Mode(true).hashPrefix('!');
}]);

afm.run(['$rootScope', 'currentUser', 'bootstrapUser', 'routeHistory', 'User',
    function($rootScope, currentUser, bootstrapUser, routeHistory, User){
    $rootScope.currentUser = currentUser;
    $rootScope.logout = function() {
        if (currentUser.isLogged()) {
            currentUser.clear();
            User.logout();
        }
    };

    currentUser.update(bootstrapUser);
}]);

afm.directive('radioCursor', ['$rootScope', function($rootScope){
    return {
        restrict: 'C',
        link: function($scope, element) {
            $rootScope.$on('playlist.currentElement', function(ev, el){
                var centerOffset = Math.round(el.prop('offsetWidth') / 2);
                // TODO: add random
                var left = el.prop('offsetLeft') + centerOffset;
                element.css('left', left + 'px');
            });
        }
    };
}]);

afm.directive('volumeWrapper', function(){
    return {
        restrict: 'C',
        link: function(scope, element) {
            element.bind('mouseenter', function(){
                element.addClass('hover');
                scope.$broadcast('volumeShow');
            });
            element.bind('mouseout', function(){
                element.removeClass('hover');
            });
        }
    };
});

// TODO: add touch support
afm.directive('volumeHandle', ['$rootScope', '$document', function($rootScope, $document){
    return {
        restrict: 'A',
        scope: {
            volume: '=',
            onChange: '&'
        },
        link: function(scope, element) {
            var startValue;
            var startPosition;
            var max = 1.0;
            var volumeLine = element.parent();

            scope.$on('volumeShow', function(){
                updateValue(scope.volume);
            });

            scope.$watch('volume', function(volume){
                updateValue(volume);
            });

            volumeLine.bind('click', function(e){
                // TODO: offsetY available only on Chrome, support other browsers
                updateValue(posToValue(e.offsetY - element.prop('offsetHeight') / 2));
            });

            element.bind('click', function(e){
                e.stopPropagation();
            });

            element.bind('mousedown', function(e){
                startPosition = e.pageY;
                startValue = parseFloat(scope.volume) || 0;
            });

            $document.bind('mousemove', function(e){
                if (!startPosition) {
                    return;
                }
                var pos = e.pageY - startPosition;
                var value = startValue - (pos / getLineHeight()) * max;
                value = clamp(value, 0, max);
                updateValue(value);
            });

            $document.bind('mouseup', function(){
                startPosition = startValue = null;
            });

            function posToValue(pos) {
                pos = Math.abs(getLineHeight() - clamp(pos, 0, getLineHeight()));
                return pos ? (pos / getLineHeight()) * max : 0;
            }

            function getLineHeight() {
                return volumeLine.prop('offsetHeight') - element.prop('offsetHeight');
            }

            function updateValue(value) {
                value = clamp(parseFloat(value), 0, max);
                // decimal round
                value = Math.round(value * 10) / 10;
                var pos = getLineHeight();
                if (value > 0) {
                    pos = (Math.abs(max - value) / max) * getLineHeight();
                }
                // TODO: investigation - fix apply already in progress
                // TODO: fix this shit
                scope.volume = value;
                element.css('top', Math.round(pos) + 'px');
                if (!$rootScope.$$phase) { $rootScope.$apply(); }
                scope.onChange();
            }

            function clamp(value, min, max) {
                if (value <= min) { value = min; }
                if (value >= max) { value = max; }
                return value;
            }
        }
    };
}]);

afm.directive('stationLink', ['$rootScope', function($rootScope){
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
}]);

// TODO: prevent body scroll
afm.directive('tracksBox', ['$document', function($document){
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
            $document.bind('click', function(){
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
    };
}]);

afm.factory('routeHistory', ['$rootScope', '$route', '$location', function($rootScope, $route, $location){
    var returnTo = $route.current && !$route.current.$route.modal ? $location.path() : '/';
    $rootScope.$on('$routeChangeSuccess', function(target, current){
        if (current.$route && !current.$route.modal) {
            returnTo = $location.path();
        }
    });
    return {
        backToNotModal: function() {
            $location.path(returnTo);
        }
    };
}]);

afm.directive('modal', ['$document', 'routeHistory', function($document, routeHistory){
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
                routeHistory.backToNotModal();
            });
            // close on escape
            $document.bind('keyup', function(e){
                if (e.keyCode == 27) {
                    routeHistory.backToNotModal();
                }
            });
        }
    };
}]);

afm.directive('modalBox', ['$route', function($route){
    return {
        restrict: 'AC',
        link: function(scope, element) {
            scope.$on('$routeChangeSuccess', update);
            update();

            function update() {
                var modal = $route.current && $route.current.modal;
                element.css('display', modal ? 'block' : 'none');
            }
        }
    };
}]);

afm.factory('audio', ['$document', function($document) {
    var audio = $document[0].createElement('audio');
    return audio;
}]);


afm.directive('flashEngine', ['$window', 'player', function($window, player){
    $window.flashPlayerCallback = player.flashCallback;
    return {
        restrict: 'C',
        link: function(scope, element, attrs) {
            // TODO: move swfobject to provider
            swfobject.embedSWF(attrs.src, attrs.id, 1, 1, '10', false, {}, {
                allowScriptAccess: 'always',
                wmode: 'transparent'
            }, {});
        }
    };
}]);

afm.factory('player', ['$rootScope', 'storage', function($rootScope, storage) {
    var player = {
        url: null,
        volume: 0.6,
        muted: false,
        playing: false,
        defaultVolume: 0.6,
        flashAudio: null,

        play: function(url) {
            if (url) {
                player.url = url;
            }

            if (player.url && player.flashAudio) {
                player.flashAudio.playStream(player.url);
                player.playing = true;
            }
        },

        stop: function() {
            if (player.url && player.flashAudio) {
                player.flashAudio.stopStream();
            }
            player.playing = false;
        },

        setAudioVolume: function(volume) {
            if (player.flashAudio) {
                player.flashAudio.setVolume(volume);
            }
        },

        loadVolume: function() {
            var volume = parseFloat(storage.get('volume'));
            // громкость не установлена в куках - берем по умолчанию
            if (isNaN(volume)) {
                volume = player.defaultVolume;
            }
            player.setVolume(volume);
        },

        setVolume: function(volume) {
            volume = parseFloat(volume);
            player.volume = volume;
            player.setAudioVolume(volume);
            storage.put('volume', volume);
        },

        mute: function() {
            player.setAudioVolume(0);
            player.muted = player.volume;
        },

        unmute: function() {
            player.setVolume(player.muted || player.defaultVolume);
            player.muted = false;
        },

        isMuted: function() {
            // TODO: fix this shit
            return angular.isNumber(player.muted);
        },

        flashCallback: function(event) {
            if (event == 'stopped') {
                player.playing = false;
            }
            if (event == 'playing') {
                player.playing = true;
            }
            if (event == 'ready') {
                player.flashAudio = document.getElementById('flash-player-engine');
                player.setAudioVolume(player.volume);
                player.play();
            }
            $rootScope.$apply();
        }
    };

    player.loadVolume();
    return player;
}]);

afm.factory('storage', ['$window', '$cacheFactory', '$log', function($window, $cacheFactory, $log){
    try {
        // test localStorage
        var storage = $window.localStorage;
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
            };
        }
    } catch(e) {}
    // fallback
    $log.warn('localStorage not available. fallback used.');
    return $cacheFactory('storage');
}]);

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

afm.factory('favorites', ['$rootScope', 'currentUser', 'storage', 'UserFavorite',
    function($rootScope, currentUser, storage, UserFavorite) {
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
                result.unshift(obj);
            });
            return result;
        }
    };
}]);

afm.factory('User', ['$http', function($http){
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
}]);

afm.factory('Station', ['$http', function($http){
    return {
        get: function(stationId) {
            return $http.get('/api/station/' + stationId);
        }
    };
}]);

afm.factory('UserFavorite', ['$http', function($http){
    return {
        add: function(id) {
            $http.post('/api/user/favorites/' + id + '/add');
        },

        remove: function(id) {
            $http.post('/api/user/favorites/' + id + '/remove');
        },

        list: function(cb) {
            $http.get('/api/user/favorites').success(function(response){
                cb(response.objects);
            });
        }
    };
}]);

afm.factory('UserTrack', ['$http', function($http){
    return {
        add: function(id) {
            $http.post('/api/user/tracks/' + id + '/add');
        },

        remove: function(id) {
            $http.post('/api/user/tracks/' + id + '/remove');
        },

        restore: function(id) {
            $http.post('/api/user/tracks/' + id + '/restore');
        },

        list: function(cb) {
            $http.get('/api/user/tracks').success(function(response){
                cb(response.objects);
            });
        }
    };
}]);

afm.factory('passErrorToScope', function(){
    return function($scope) {
        return function(response, statusCode) {
            var error = {};
            if (angular.isObject(response) && response.error) {
                error.reason = response.error;
            }
            error.code = statusCode;
            $scope.error = error;
        };
    };
});

afm.controller('LoginCtrl', ['$scope', '$location', 'currentUser', 'User', 'passErrorToScope',
    function($scope, $location, currentUser, User, passErrorToScope){
    if (currentUser.isLogged()) {
        $location.path('/');
        return;
    }

    $scope.form = {};

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
}]);

afm.controller('SignupCtrl', ['$scope', '$location', 'currentUser', 'User', 'passErrorToScope',
    function($scope, $location, currentUser, User, passErrorToScope){

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
}]);

afm.controller('AmnesiaCtrl', ['$scope', '$location', 'currentUser', 'User', 'passErrorToScope',
    function($scope, $location, currentUser, User, passErrorToScope){
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
}]);

afm.factory('Feedback', ['$http', function($http) {
    return {
        send: function(params) {
            return $http.post('/api/feedback', params);
        }
    };
}]);

afm.controller('FeedbackCtrl', ['$scope', 'Feedback', 'passErrorToScope',
    function($scope, Feedback, passErrorToScope){
        $scope.form = {};

        $scope.$watch('form', function(){
            $scope.error = null;
        }, true);

        $scope.feedback = function() {
            $scope.error = null;
            $scope.result = null;
            Feedback.send($scope.form).success(function(result){
                $scope.result = result;
            }).error(passErrorToScope($scope));
        };
}]);

afm.factory('Playlist', ['$http', function($http){
    return {
        get: function(playlist) {
            return $http.get('/api/radio/' + playlist);
        }
    };
}]);

/**
 * Контролер плейлиста
 */
afm.controller('PlaylistCtrl', ['$scope', '$http', 'radio', 'bootstrapGenres', function($scope, $http, radio, bootstrapGenres){
    $scope.tabs = [];
    angular.forEach(bootstrapGenres, function(genre){
        $scope.tabs.push({
            id: 'genre/' + genre.id,
            title: genre.title
        });
    });

    $scope.playlist = [];
    $scope.searchQuery = '';
    $scope.currentTab = null;
    // ids list for fast lookup
    var playlistIds = [];

    $scope.selectTab = function(tabId) {
        $scope.playlist = [];
        $scope.currentTab = tabId;

        $http.get('/api/radio/' + tabId).success(function(response){
            playlistIds = [];
            $scope.playlist = response.objects;
            angular.forEach(response.objects, function(station){
                playlistIds.push(station.id);
            });
        });
    };

    $scope.tabClass = function(tabId) {
        var selected = (tabId == $scope.currentTab) && !$scope.searchQuery;
        return {selected: selected};
    };

    $scope.showCursor = function() {
        if ($scope.searchQuery || !radio.isStationLoaded()) {
            return false;
        }
        return playlistIds.indexOf(radio.getStation().id) >= 0;
    };
}]);

afm.factory('radio', ['$rootScope', function($rootScope){
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
}]);

afm.controller('RadioStationCtrl', ['station', 'radio', 'player', function(station, radio, player){
    // prevent double load station, sound cause flickering
    if (radio.isStationLoaded() && radio.getStation().id == station.id) {
        return;
    }
    radio.selectStation(station);
    player.play(station.stream.listen_url);
}]);

afm.controller('RadioCtrl', ['$scope', '$http', '$location', 'player', 'radio',
    function($scope, $http, $location, player, radio){
    $scope.currentStation = radio.getStation;
    $scope.previousStation = radio.previousStation;

    $scope.itemClass = function(item, current) {
        var selected = current && current.id == item.id;
        return {selected: selected};
    };

    $scope.selectStation = function(station) {
        $location.path('/listen/' + station.id);
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

    $scope.isMuted = function() {
        return !$scope.volume || player.isMuted();
    };

    $scope.play = function() {
        player.play();
    };

    $scope.stop = function() {
        player.stop();
    };

    $scope.isPlaying = function() {
        return player.playing;
    };

    $scope.toggleMute = function() {
        if ($scope.isMuted()) {
            player.unmute();
            $scope.volume = player.volume;
        } else {
            player.mute();
            $scope.volume = 0;
        }
    };
}]);

afm.controller('FavoritesCtrl', ['$scope', 'favorites', function($scope, favorites){
    $scope.getFavorites = function() {
        return favorites.get();
    };

    $scope.remove = function(id) {
        favorites.remove(id);
    };
}]);

afm.directive('clock', ['$timeout', 'dateFilter', function($timeout, dateFilter) {
    // return the directive link function. (compile function not needed)
    return function(scope, element, attrs) {
        var timeoutId; // timeoutId, so that we can cancel the time updates

        // used to update the UI
        function updateTime() {
            var date = new Date();
            var delimiter = (date.getSeconds() % 2) ? '&nbsp;' : ':';
            var text = dateFilter(date, 'HH mm').replace(' ', '<span class="dots">'+delimiter+'</span>');
            element.html(text);
        }

        scope.$watch(attrs.clock, function(value) {
            if (value) {
                $timeout.cancel(timeoutId);
                element.css('display', 'none');
            } else {
                updateLater();
                element.css('display', 'block');
            }
        });

        // schedule update in one second
        function updateLater() {
            // save the timeoutId for canceling
            timeoutId = $timeout(function() {
                updateTime(); // update DOM
                updateLater(); // schedule another update
            }, 1000);
        }

        // listen on DOM destroy (removal) event, and cancel the next UI update
        // to prevent updating time ofter the DOM element was removed.
        element.bind('$destroy', function() {
            $timeout.cancel(timeoutId);
        });
    };
}]);

afm.factory('onair', ['$rootScope', 'currentUser', 'radio', 'comet', function($rootScope, currentUser, radio, comet){
    var params = {};
    var track = null;

    $rootScope.$watch(function() { return currentUser.isLogged(); }, function(logged){
        // TODO: rename user_id => uid
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
    };
}]);

afm.controller('DisplayCtrl', ['$rootScope', '$scope', 'radio', 'currentUser', 'favorites', 'tracks', 'onair',
    function($rootScope, $scope, radio, currentUser, favorites, tracks, onair) {
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
}]);

afm.factory('tracks', ['$rootScope', 'currentUser', 'storage', 'UserTrack',
    function($rootScope, currentUser, storage, UserTrack) {
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
                result.unshift(obj);
            });
            return result;
        }
    };
}]);

afm.controller('TracksCtrl', ['$scope', '$rootScope', '$filter', 'currentUser', 'tracks',
    function($scope, $rootScope, $filter, currentUser, tracks){
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
    };
}]);

afm.controller('MenuCtrl', ['$scope', '$rootScope', function($scope, $rootScope){
    $scope.toggleTracks = function($event) {
        $rootScope.$broadcast('tracks.toggle');
        $event.stopPropagation();
    };
}]);

afm.controller('MyRadioCtrl', function($scope, $http){
    $scope.radioList = [];
    $http.get('/api/my/radio').success(function(response){
        $scope.radioList = response.objects;
    });
});

window.afm = afm;
})(window, angular, Comet);