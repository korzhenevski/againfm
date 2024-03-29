angular.module('afm.player', ['afm.base', 'afm.sound', 'afm.comet', 'afm.user'])

.config(function ($routeProvider, cometProvider, $stateProvider, $locationProvider) {
    cometProvider.setUrl('http://comet.' + document.location.host);

    $locationProvider.html5Mode(true);

    $stateProvider.state('home', {
        url: '/',
        template: '<div ng-init="visible=false"></div>'
    });

    $stateProvider.state('listen', {
        url: '/listen/:radioId',
        controller: 'ListenCtrl'
    });

    $stateProvider.state('favorite_radio', {
        templateUrl: 'favorite_radio.html',
        controller: 'FavoriteRadioCtrl'
    });

    $stateProvider.state('onair', {
        templateProvider: function(Radio, $http){
            var url = '/_radio/' + Radio.cur.id + '/onair_history';
            return $http.get(url).then(function(response) { return response.data; });
        }
    });
})

.controller('ListenCtrl', function ($rootScope, $stateParams, $http, Radio, trackEvent) {
    if (Radio.cur.id == $stateParams.radioId) {
        return;
    }

    Radio.reset();
    $http.get('/_radio/' + $stateParams.radioId).success(function (radio) {
        Radio.listen(radio);
    }).error(function (resp, statusCode) {
        trackEvent('player', {act: 'listen_error', rid: parseInt($stateParams.radioId)});
        $rootScope.$broadcast('radioListenError', statusCode);
    });
})

.factory('Radio', function ($rootScope, $http, player) {
    return {
        cur: {},
        stream: {},

        set: function (radio) {
            this.cur.id = radio.id;
            this.cur.title = radio.title;
            this.cur.description = radio.description || '';
        },

        reset: function () {
            this.set({});
            this.stream = {};
            player.stop();
        },

        listen: function (radio) {
            if (radio.id != this.cur.id) {
                this.play(radio);
            }
            this.set(radio);
        },

        play: function (radio) {
            var self = this;

            if (radio.stream) {
                self.stream = angular.copy(radio.stream);
                player.play(self.stream.url);
            } else {
                $http.get('/_radio/' + radio.id + '/stream').success(function(stream){
                    self.stream = stream;
                    player.play(stream.url);
                }).error(function (resp, statusCode) {
                    $rootScope.$broadcast('radioListenError', statusCode);
                });
            }

            $rootScope.$broadcast('radioListen', radio);
        }
    }
})

.factory('favorites', function ($rootScope, user, storage, UserFavorite, collectionFactory) {
    var name = 'favorites' + (user.isLogged() ? '_user' + user.get().id : '');
    var coll = collectionFactory(name);

    // load favorites list
    if (user.isLogged()) {
        coll.removeAll();
        UserFavorite.list(function(objects){
            angular.forEach(objects, function(obj){
                coll.add(obj['id'], obj);
            });
        });
    }

    var favorites = angular.extend({}, coll, {
        add: function(id, obj) {
            coll.add(id, obj);
            if (user.isLogged()) {
                UserFavorite.add(id);
            }
        },

        remove: function (id) {
            coll.remove(id);
            if (user.isLogged()) {
                UserFavorite.remove(id);
            }
        }
    });
        
    return favorites;
})

.factory('UserFavorite', function ($http) {
    return {
        add: function (id) {
            $http.post('/_user/favorites/' + id + '/add');
        },

        remove: function (id) {
            $http.post('/_user/favorites/' + id + '/remove');
        },

        list: function (cb) {
            $http.get('/_user/favorites').success(function (response) {
                cb(response.objects);
            });
        }
    };
})

.directive('spinner', function () {
    return {
        restrict: 'CA',
        templateUrl: 'spinner.html',
        link: function ($scope, element) {
            $scope.$on('loading', function () {
                element.css('display', 'block');
            });
            $scope.$on('loaded', function () {
                element.css('display', 'none');
            });
        }
    };
})

.factory('history', function (collectionFactory, config) {
    var history = collectionFactory('history', {capacity: config.listenHistorySize});
    return angular.extend(history, {
        getPrevious: function() {
            var list = history.list();
            if (list.length > 1) {
                return list[1];
            }
        }
    });
})

.controller('PlaylistCtrl', function ($scope, $http, $timeout, $location, history, Radio) {
    $scope.searchQuery = '';
    $scope.tabs = [];
    $scope.playlist = [];

    $scope.addTab = function(id, title) {
        $scope.tabs.push({id: id, title: title});
    };

    $scope.initTabs = function () {
        angular.forEach($scope.genres, function (genre) {
            $scope.addTab('genre/' + genre.id, genre.title);
        });
        $scope.selectTab($scope.tabs[0].id);
        /*
        if (history.isEmpty()) {
            $scope.selectTab('featured');
        } else {
            $scope.selectTab('history');
        }
        */
    };

    $scope.$on('playerFreePlay', function () {
        if ($scope.playlist.length) {
            $location.path('/listen/' + $scope.playlist[0].id);
        }
    });

    $scope.$on('playerPlaying', function () {
        history.add(Radio.cur.id, Radio.cur);
    });

    $scope.isHistoryEmpty = function () {
        return true;
        //return history.isEmpty();
    };

    $scope.noSearchResults = function () {
        return $scope.currentTab && $scope.currentTab.indexOf('search') !== -1 && !$scope.playlist.length;
    };

    $scope.search = function (searchQuery) {
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
    $scope.$watch('searchQuery', function (searchQuery) {
        if (searchThrottle) {
            $timeout.cancel(searchThrottle);
        }

        searchThrottle = $timeout(function () {
            $scope.search(searchQuery);
        }, 200);
    });

    function resetSearch() {
        if ($scope.searchQuery) {
            $scope.searchQuery = '';
            $scope.prevTab = null;
        }
    }

    $scope.selectTab = function (tabId) {
        if (tabId.indexOf('search') == -1) {
            resetSearch();
        }

        $scope.currentTab = tabId;
        if ($scope.currentTab == 'history') {
            $scope.playlist = history.list();
            return;
        }

        $scope.$broadcast('loading');
        $http.get('/_radio/' + tabId).success(function (response) {
            $scope.playlist = response.objects;
            $scope.$broadcast('loaded');
        }).error(function () {
            $scope.playlist = [];
            $scope.$broadcast('loaded');
        });
    };

    $scope.tabClass = function (tabId) {
        var selected = (tabId == $scope.currentTab);
        return {selected: selected};
    };
})

.directive('volumeSlider', function ($rootScope, $document) {
    return {
        restrict: 'C',
        link: function (scope, element) {
            var startValue;
            var startPosition;
            var volumeLine = element.parent();
            var lineWidth = volumeLine.prop('offsetWidth') - element.prop('offsetWidth');
            var max = 1.0;

            element.bind('click', function (e) {
                e.stopPropagation();
            });

            scope.$watch('volume', function (volume) {
                updateValue(volume, 'skipScope');
            });

            volumeLine.bind('click', function (e) {
                var value = posToValue(e.offsetX - element.prop('offsetWidth') / 2);
                // TODO: offsetY available only on Chrome, support other browsers
                updateValue(value);
            });

            element.bind('mousedown', function (e) {
                startPosition = e.pageX;
                startValue = parseFloat(scope.volume) || 0;
                $document.find('body').addClass('moving');
            });

            $document.bind('mousemove', function (e) {
                if (!startPosition) {
                    return;
                }
                var pos = startPosition - e.pageX;
                var value = startValue - (pos / lineWidth) * max;
                value = clamp(value, 0, max);
                updateValue(value);
            });

            $document.bind('mouseup', function () {
                startPosition = startValue = null;
                $document.find('body').removeClass('moving');
            });

            function posToValue(pos) {
                return pos ? (pos / lineWidth) * max : 0;
            }

            function updateValue(value, skipScope) {
                value = clamp(parseFloat(value), 0, max);
                value = Math.round(value * 100) / 100;
                var pos = 0;
                if (value > 0) {
                    pos = (value / max) * lineWidth;
                }
                element.css('left', Math.round(pos) + 'px');
                if (!skipScope) {
                    scope.volume = value;
                    scope.$apply();
                }
            }

            function clamp(value, min, max) {
                if (value <= min) {
                    value = min;
                }
                if (value >= max) {
                    value = max;
                }
                return value;
            }
        }
    }
})

.controller('PlayerCtrl', function ($scope, Radio, title, trackEvent) {
    $scope.currentRadio = Radio.cur;

    $scope.currentClass = function (radio) {
        return {selected: Radio.cur && Radio.cur.id == radio.id};
    };

    $scope.$on('radioListen', function (ev, radio) {
        title.change(radio.title);
    });

    function ts() {
        return Math.round(+(new Date()) / 1000);
    }

    var playStart = 0;
    $scope.$on('playerPlaying', function(){
        playStart = ts();
        trackEvent('player', {act: 'play', sid: Radio.stream.id});
    });

    $scope.$on('playerStopped', function(){
        if (playStart) {
            trackEvent('player', {act: 'stop', dur: ts() - playStart});
        }
        playStart = 0;
    });
})

.controller('PlayerControlsCtrl', function ($scope, $http, $location, player, history, Radio, trackEvent) {
    $scope.play = function () {
        if (Radio.cur.id) {
            Radio.play(Radio.cur);
        } else {
            $scope.$root.$broadcast('playerFreePlay');
        }
    };

    $scope.selectRadio = function (radio) {
        $location.path('/listen/' + radio.id);
    };

    $scope.stop = function () {
        player.stop();
    };

    $scope.randomRadio = function () {
        $http.get('/_radio/random').success(function (radio) {
            trackEvent('player', {act: 'random', rid: radio.id});
            $scope.selectRadio(radio);
        });
    };

    $scope.previousRadio = function () {
        var radio = history.getPrevious();
        if (radio) {
            trackEvent('player', {act: 'previous', rid: radio.id});
            $scope.selectRadio(radio);
        }
    };

    $scope.isPlaying = function () {
        return player.playing;
    };

    $scope.volume = player.volume;
    $scope.$watch('volume', function (volume) {
        player.updateVolume(volume);
    });
})

.controller('FavoritesCtrl', function ($scope, favorites, $filter, $state) {
    $scope.getFavorites = function () {
        return favorites.list();
    };

    $scope.showModal = function () {
        $state.transitionTo('favorite_radio');
    };
})

.directive('clock', function ($timeout, dateFilter) {
    // return the directive link function. (compile function not needed)
    return function (scope, element, attrs) {
        var timeoutId; // timeoutId, so that we can cancel the time updates

        // used to update the UI
        function updateTime() {
            var date = new Date();
            var delimiter = (date.getSeconds() % 2) ? '&nbsp;' : ':';
            var text = dateFilter(date, 'HH mm').replace(' ', '<span class="dots">' + delimiter + '</span>');
            element.html(text);
        }

        scope.$watch(attrs.clock, function (value) {
            if (value) {
                updateLater();
                element.css('display', 'block');
            } else {
                $timeout.cancel(timeoutId);
                element.css('display', 'none');
            }
        });

        // schedule update in one second
        function updateLater() {
            // save the timeoutId for canceling
            timeoutId = $timeout(function () {
                updateTime(); // update DOM
                updateLater(); // schedule another update
            }, 1000);
        }

        // listen on DOM destroy (removal) event, and cancel the next UI update
        // to prevent updating time ofter the DOM element was removed.
        element.bind('$destroy', function () {
            $timeout.cancel(timeoutId);
        });
    };
})

.factory('onair', function ($rootScope, user, comet, config) {
    var onair = {};

    function onAir(response) {
        onair = response;
        $rootScope.$apply();
    }

    return {
        get: function () {
            return onair && onair.air;
        },

        getListeners: function() {
            return onair && onair.listeners || 0;
        },

        subscribe: function(radioId) {
            comet.unsubscribe();
            var params = {wait: config.cometWait};
            if (user.isLogged()) {
                params.uid = user.id;
            }
            comet.subscribe('/air/' + radioId, params, onAir);
        },

        unsubscribe: function() {
            onair = null;
            comet.unsubscribe();
        }
    };
})

.controller('FavoriteRadioCtrl', function ($scope, favorites) {
    $scope.getList = function () {
        return favorites.list();
    };

    $scope.isEmpty = function() {
        return favorites.isEmpty();
    };

    $scope.remove = function (id) {
        favorites.remove(id);
    }
})

.controller('DisplayCtrl', function ($scope, $state, Radio, favorites, onair, player) {
    $scope.titleClass = function() {
        return {
            starred: Radio.cur.id && favorites.exists(Radio.cur.id)
        };
    };

    $scope.star = function () {
        if (!Radio.cur.id) {
            return;
        }

        if (favorites.exists(Radio.cur.id)) {
            favorites.remove(Radio.cur.id);
        } else {
            favorites.add(Radio.cur.id, Radio.cur);
        }
    };

    $scope.isInfoVisible = function() {
        return Radio.cur.id && !$scope.error;
    };

    $scope.isClockVisible = function() {
        return !Radio.cur.id && !$scope.error;
    };

    $scope.$on('playerPlaying', function(){
        onair.subscribe(Radio.cur.id);
    });

    $scope.$on('playerStopped', function(){
        onair.unsubscribe();
    });

    $scope.$on('radioListen', function () {
        $scope.error = false;
    });

    $scope.$on('radioListenError', function (error) {
        $scope.error = error;
    });

    $scope.hasAirInfo = function() {
        var air = onair.get();
        return air && air.id;
    };

    $scope.getListeners = onair.getListeners;

    $scope.getSubtitle = function() {
        var air = onair.get();
        if (air && air.title && player.playing) {
            return air.title;
        }

        return Radio.cur.description;
    };

    $scope.getCaption = function() {
        return [$scope.getSubtitle()];
    };

    $scope.showAir = function() {
        $state.transitionTo('onair');
    };
});