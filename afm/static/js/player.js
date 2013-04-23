angular.module('afm.player', ['afm.base', 'afm.sound', 'afm.comet'])

.config(function($routeProvider, $locationProvider, cometProvider){
    cometProvider.setUrl('http://comet.' + document.location.host);
    $locationProvider.html5Mode(true).hashPrefix('!');
})

.run(function($rootScope, user, User){
    $rootScope.user = user;
    $rootScope.logout = function() {
        if (user.isLogged()) {
            user.clear();
            User.logout();
        }
    };
    user.update($rootScope.bootstrapUser);
})

.directive('volumeWrapper', function(){
    return {
        restrict: 'C',
        link: function(scope, element) {
            element.bind('mouseenter', function(){
                element.find('div').removeClass('hidden');
                scope.$broadcast('volumeShow');
            });
            element.bind('mouseout', function(){
                element.find('div').addClass('hidden');
            });
        }
    };
})

// TODO: add touch support
.directive('volumeHandle', function($rootScope, $document){
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
})

// TODO: prevent body scroll
.directive('tracksBox', function($document){
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
})

.factory('routeHistory', function($rootScope, $route, $location){
    var returnTo = $route.current && !$route.current.$route.modal ? $location.path() : '/';
    $rootScope.$on('$routeChangeSuccess', function(target, current){
        if (current && current.$route && !current.$route.modal) {
            returnTo = $location.path();
        }
    });
    return {
        backToNotModal: function() {
            $location.path(returnTo);
        }
    };
})

.directive('modal', function($document, routeHistory){
    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
            title: '@'
        },
        template: '<div class="modal" ui-animate><h1 class="header">{{ title }} <i class="close"></i></h1>' +
                  '<div ng-transclude></div></div>',
        link: function(scope, element, attrs) {
            element.addClass('modal-' + attrs.id);
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
})

.directive('modalBox', function($route){
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
})

.factory('player', function($rootScope, storage) {
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
})

.factory('favorites', function($rootScope, user, storage, UserFavorite) {
    var STORAGE_ID = 'favorites';
    var favorites = storage.get(STORAGE_ID) || {};

    // sync favorites to localstorage
    $rootScope.$watch(function() { return favorites; }, function(data){
        if (!user.isLogged()) {
            storage.put(STORAGE_ID, data);
        }
    }, true);

    $rootScope.$watch(function() {
        return user.isLogged();
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
            if (user.isLogged()) {
                UserFavorite.add(id);
            }
        },

        remove: function(id) {
            if (favorites.hasOwnProperty(id)) {
                delete favorites[id];
            }
            if (user.isLogged()) {
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
})

.factory('Station', function($http){
    return {
        get: function(stationId) {
            return $http.get('/api/station/' + stationId);
        }
    };
})

.factory('UserFavorite', function($http){
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
})

.factory('UserTrack', function($http){
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
})

.controller('LoginCtrl', function($scope, $location, user, User, passErrorToScope){
    if (user.isLogged()) {
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
            user.update(response.user);
            $location.path('/');
        }).error(passErrorToScope($scope));
    };
})

.controller('SignupCtrl', function($scope, $location, user, User, passErrorToScope){

    if (user.isLogged()) {
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
            user.update(response.user);
            $location.path('/');
        }).error(passErrorToScope($scope));
    };
})

.controller('AmnesiaCtrl', function($scope, $location, user, User, passErrorToScope){
    if (user.isLogged()) {
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
})

.factory('Feedback', function($http) {
    return {
        send: function(params) {
            return $http.post('/api/feedback', params);
        }
    };
})

.controller('FeedbackCtrl', function($scope, Feedback, passErrorToScope){
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
})

.directive('loader', function(){
    return {
        restrict: 'C',
        templateUrl: '/loader.html',
        link: function($scope, element) {
            $scope.$on('loading', function(){
                element.css('display', 'block');
            });
            $scope.$on('loaded', function(){
                element.css('display', 'none');
            });
        }
    };
})

/**
 * Контролер плейлиста
 */
.controller('PlaylistCtrl', function($scope, $http, $timeout){
    $scope.searchQuery = '';
    $scope.tabs = [];
    $scope.playlist = [];

    $scope.$on('freePlay', function(){
        if ($scope.playlist) {
            $scope.selectStation($scope.playlist[0]);
        }
    });

    angular.forEach($scope.bootstrapGenres, function(genre){
        $scope.tabs.push({
            id: 'genre/' + genre.id,
            title: genre.title
        });
    });

    $scope.hasList = function() {
        return $scope.playlist;
    };

    $scope.search = function(searchQuery) {
        if (searchQuery) {
            if (!$scope.prevTab) {
                $scope.prevTab = $scope.currentTab;
            }
            $scope.selectTab('search?q=' + searchQuery);
        } else if ($scope.prevTab) {
            $scope.selectTab($scope.prevTab);
        }
    };

    // throttle search on 0.2 sec
    var searchThrottle;
    $scope.$watch('searchQuery', function(searchQuery) {
        if (searchThrottle) {
            $timeout.cancel(searchThrottle);
        }

        searchThrottle = $timeout(function(){
            $scope.search(searchQuery);
        }, 200);
    });

    $scope.selectTab = function(tabId) {
        // если при поиске выбираем категорию, поиск сбрасывается
        if (tabId.indexOf('search') == -1 && $scope.searchQuery) {
            $scope.searchQuery = '';
            $scope.prevTab = null;
        }

        $scope.currentTab = tabId;

        $scope.$broadcast('loading');
        $http.get('/api/radio/' + tabId).success(function(response){
            $scope.playlist = response.objects;
            $scope.$broadcast('loaded');
        }).error(function(){
            $scope.playlist = [];
            $scope.$broadcast('loaded');
        });
    };

    $scope.tabClass = function(tabId) {
        var selected = (tabId == $scope.currentTab);
        return {selected: selected};
    };
})

.factory('radio', function(){
    var self = {
        id: 0,
        title: '',
        current: {},

        set: function(radio) {
            self.id = radio.id;
            self.title = radio.title;
            self.current = radio;
        },

        get: function() {
            return self.current;
        }
    };
    return self;
})

.controller('PlayerCtrl', function($scope, $http, $location, player, radio){
    $scope.radio = radio.get();

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

    $scope.play = function() {

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

    $scope.volume = player.volume;
    $scope.saveVolume = function() {
        player.setVolume($scope.volume);
    };

    $scope.isMuted = function() {
        return !$scope.volume || player.isMuted();
    };
})

.controller('FavoritesCtrl', function($scope, favorites){
    $scope.getFavorites = function() {
        return favorites.get();
    };

    $scope.remove = function(id) {
        favorites.remove(id);
    };
})

.directive('clock', function($timeout, dateFilter) {
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
})

.factory('onair', function($rootScope, user, radio, comet){
    var params = {wait: 30};
    var air = null;

    $rootScope.$watch(function() { return user.isLogged(); }, function(logged){
        // TODO: rename user_id => uid
        if (logged) {
            params.uid = user.get().id;
        } else {
            delete params.uid;
        }
        subscribe();
    });

    $rootScope.$watch(function() { return radio.get(); }, function(radio){
        if (!radio) {
            return;
        }
        params.channel = radio.air_channel;
        subscribe();
    }, true);

    function onUpdate(newTrack) {
        air = newTrack;
        // force convert to int, onair maybe return id as string
        if (angular.isString(air.id)) {
            air.id = parseInt(air.id, 10);
        }
        $rootScope.$apply();
    }

    function subscribe() {
        if (!radio.id) {
            return;
        }
        comet.unsubscribe();
        comet.subscribe('/onair/' + radio.id, params, onUpdate);
    }

    return {
        get: function() {
            return air;
        }
    };
})

/**
 * Дисплей радиостанции
 */
.controller('DisplayCtrl', function($scope, $rootScope, radio, favorites, tracks, onair) {
    $rootScope.$watch(function(){ return onair.get(); }, function(air){
        $scope.air = air;
    }, true);

    // TODO: это вообще нафига?
    $scope.$watch(function(){ return radio.get(); }, function(radio){
        $scope.title = radio ? radio.title : '';
    });

    $scope.starred = function() {
        if (!radio.id) {
            return false;
        }
        return favorites.exists(radio.id);
    };

    $scope.star = function() {
        if (!radio.id) {
            return;
        }

        if (favorites.exists(radio.id)) {
            favorites.remove(radio.id);
        } else {
            favorites.add(radio.id, radio.title);
        }
    };

    $scope.like = function() {
        var air = $scope.air;

        if (tracks.exists(air.id)) {
            tracks.remove(air.id);
            air.favorite = false;
        } else {
            tracks.add(air.id, air.title);
            air.favorite = true;
        }
    };
})

.factory('tracks', function($rootScope, user, storage, UserTrack) {
    var STORAGE_ID = 'tracks';
    var tracks = storage.get(STORAGE_ID) || {};

    // sync tracks to localstorage
    $rootScope.$watch(function() { return tracks; }, function(data){
        if (!user.isLogged()) {
            storage.put(STORAGE_ID, data);
        }
    }, true);

    $rootScope.$watch(function() {
        return user.isLogged();
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
            if (user.isLogged()) {
                UserTrack.add(id);
            }
        },

        restore: function(track) {
            tracks[track.id] = track;
            if (user.isLogged()) {
                UserTrack.restore(track.id);
            }
        },

        remove: function(id) {
            if (tracks.hasOwnProperty(id)) {
                delete tracks[id];
            }
            if (user.isLogged()) {
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
})

.controller('TracksCtrl', function($scope, $rootScope, $filter, user, tracks){
    $scope.tracks = [];
    $scope.searchQuery = '';

    // reload tracks on user login/logout
    $rootScope.$watch(function() { return user.isLogged(); }, function(){
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
})

.controller('MenuCtrl', function($scope, $rootScope){
    $scope.toggleTracks = function($event) {
        $rootScope.$broadcast('tracks.toggle');
        $event.stopPropagation();
    };
});
