angular.module('afm.player', ['afm.base', 'afm.sound', 'afm.comet', 'afm.user'])

.config(function($routeProvider, $locationProvider, cometProvider){
    cometProvider.setUrl('http://comet.' + document.location.host);
    $locationProvider.html5Mode(true);

    // controller don't execute without "template" attr
    $routeProvider.when('/radio/:radioId', {
        template: '<div></div>',
        controller: 'ListenCtrl',
        resolve: {
            radio: ['$http', '$route', 'Radio', '$q', function($http, $route, Radio, $q) {
                var radioId = ~~$route.current.params.radioId;
                if (radioId && radioId !== Radio.current.id) {
                    return $http.get('/api/radio/' + radioId).then(function(http){
                        return http.data;
                    }, function() {
                        // reject, if not found or other error
                        return $q.reject();
                    });
                }

                // reject, if invalid radioId or already listening
                return $q.reject();
            }]
        }
    });
})

.controller('ListenCtrl', function(Radio, radio){
    Radio.listen(radio);
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

.factory('player', function($rootScope, storage) {
    var player = {
        url: null,
        muted: false,
        playing: false,
        volume: 0.6,
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

    $scope.$on('playerFreePlay', function(){
        if ($scope.playlist) {
            $scope.selectRadio($scope.playlist[0]);
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

.factory('Radio', function(player){
    return {
        current: {},
        set: function(radio) {
            this.current.id = radio.id;
            this.current.title = radio.title;
        },

        listen: function(radio) {
            this.set(radio);
            player.play('/api/radio/' + radio.id + '/listen?redir=1');
        }
    }
})


.controller('PlayerCtrl', function($scope, $location, Radio){
    $scope.currentRadio = Radio.current;

    $scope.currentClass = function(radio) {
        return {selected: Radio.current && Radio.current.id == radio.id};
    };

    $scope.selectRadio = function(radio) {
        Radio.listen(radio);
        $location.path('/radio/' + radio.id);
    };
})

.controller('PlayerControlsCtrl', function($scope, $http, player, Radio){
    $scope.play = function() {
        if (Radio.current.id) {
            $scope.selectRadio(Radio.current);
        } else {
            $scope.$root.$broadcast('playerFreePlay');
        }
    };

    $scope.stop = function() {
        player.stop();
    };

    $scope.randomRadio = function() {
        $http.get('/api/radio/random').success(function(radio){
            $scope.selectRadio(radio);
        });
    };

    $scope.isPlaying = function() {
        return player.playing;
    };

    $scope.toggleMute = function() {
        if ($scope.isMuted()) {
            player.unmute();
        } else {
            player.mute();
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

.factory('onair', function($rootScope, user, comet){
    var params = {wait: 30};
    var air = null;

    /*
    $rootScope.$watch(function() { return user.isLogged(); }, function(logged){
        // TODO: rename user_id => uid
        if (logged) {
            params.uid = user.get().id;
        } else {
            delete params.uid;
        }
        subscribe();
    });

    $rootScope.$watch(function() { return radio; }, function(radio){
        if (radio && radio.air_channel) {
            params.channel = radio.air_channel;
            subscribe();
            return;
        }
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
        if (radio) {
            comet.unsubscribe();
            comet.subscribe('/onair/' + radio.id, params, onUpdate);
        }
    }*/

    return {
        get: function() {
            return air;
        }
    };
})

/**
 * Дисплей радиостанции
 */
.controller('DisplayCtrl', function($scope, Radio, favorites, onair) {
    $scope.$watch(function(){ return onair.get(); }, function(air){
        $scope.air = air;
    }, true);

    $scope.starred = function() {
        if (Radio.current.id) {
            return favorites.exists(Radio.current.id);
        }
    };

    $scope.star = function() {
        if (Radio.current.id) {
            if (favorites.exists(Radio.current.id)) {
                favorites.remove(Radio.current.id);
            } else {
                favorites.add(Radio.current.id, Radio.current.title);
            }
        }
    };


});