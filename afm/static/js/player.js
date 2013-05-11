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

.factory('history', function(storage, $filter){
    var history = storage.get('history');
    return {
        history: history || {},
        add: function(radio) {
            this.history[radio.id] = {id: radio.id, title: radio.title, ts: +new Date()};
            storage.put('history', this.history);
        },

        getList: function() {
            var list = [];
            for (var i in this.history) {
                if (this.history.hasOwnProperty(i)) {
                    list.push(this.history[i]);
                }
            }
            // order by latest usage
            return $filter('orderBy')(list, 'ts', true);
        },

        has: function() {
            var i;
            for (i in this.history) {
                return true;
            }
            return false;
        },

        getPrevious: function() {
            var list = this.getList();
            if (list.length > 1) {
                return list[1];
            }
        }
    };
})

.controller('PlaylistCtrl', function($scope, $http, $timeout, history){
    $scope.searchQuery = '';
    $scope.tabs = [];
    $scope.playlist = [];

    $scope.$on('playerFreePlay', function(){
        if ($scope.playlist) {
            $scope.selectRadio($scope.playlist[0]);
        }
    });

    $scope.initTabs = function() {
        angular.forEach($scope.genres, function(genre){
            $scope.tabs.push({
                id: 'genre/' + genre.id,
                title: genre.title
            });
        });

        if ($scope.hasHistory()) {
            $scope.selectTab('history');
        } else {
            $scope.selectTab('featured');
        }
    };

    $scope.hasHistory = function() {
        return history.has();
    };

    $scope.hasList = function() {
        return !!$scope.playlist.length;
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

    function resetSearch() {
        if ($scope.searchQuery) {
            $scope.searchQuery = '';
            $scope.prevTab = null;
        }
    }

    $scope.selectTab = function(tabId) {
        if (tabId.indexOf('search') == -1) {
            resetSearch();
        }

        $scope.currentTab = tabId;
        if ($scope.currentTab == 'history') {
            $scope.playlist = history.getList();
            return;
        }

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

.directive('volumeSlider', function($rootScope, $document){
    return {
        restrict: 'C',
        link: function(scope, element) {
            var startValue;
            var startPosition;
            var volumeLine = element.parent();
            var lineWidth = volumeLine.prop('offsetWidth') - element.prop('offsetWidth');
            var max = 1.0;

            element.bind('click', function(e){
                e.stopPropagation();
            });

            scope.$watch('volume', function(volume){
                updateValue(volume, 'skipScope');
            });

            volumeLine.bind('click', function(e){
                var value = posToValue(e.offsetX - element.prop('offsetWidth') / 2);
                // TODO: offsetY available only on Chrome, support other browsers
                updateValue(value);
            });

            element.bind('mousedown', function(e){
                startPosition = e.pageX;
                startValue = parseFloat(scope.volume) || 0;
                $document.find('body').addClass('global-pointer');
            });

            $document.bind('mousemove', function(e){
                if (!startPosition) {
                    return;
                }
                var pos = startPosition - e.pageX;
                var value = startValue - (pos / lineWidth) * max;
                value = clamp(value, 0, max);
                updateValue(value);
            });

            $document.bind('mouseup', function(){
                startPosition = startValue = null;
                $document.find('body').removeClass('global-pointer');
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
                if (value <= min) { value = min; }
                if (value >= max) { value = max; }
                return value;
            }            
        }
    }
})

.factory('Radio', function($rootScope, $http, player, history){
    return {
        current: {},
        set: function(radio) {
            this.current.id = radio.id;
            this.current.title = radio.title;
        },

        listen: function(radio) {
            this.set(radio);
            player.play('/api/radio/' + radio.id + '/listen?redir=1');
            history.add(radio);
            $rootScope.$broadcast('radioListen', radio);
        }
    }
})

.controller('PlayerCtrl', function($scope, $location, Radio, $document){
    $scope.currentRadio = Radio.current;

    $scope.currentClass = function(radio) {
        return {selected: Radio.current && Radio.current.id == radio.id};
    };

    $scope.selectRadio = function(radio) {
        Radio.listen(radio);
        $location.path('/radio/' + radio.id);
    };

    $scope.$on('radioListen', function(event, radio){
        $document[0].title = radio.title;
    });
})

.controller('PlayerControlsCtrl', function($scope, $http, player, history, Radio){
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

    $scope.previousRadio = function() {
        var radio = history.getPrevious();
        if (radio) {
            $scope.selectRadio(radio);
        }
    };

    $scope.isPlaying = function() {
        return player.playing;
    };

    $scope.volume = player.volume;
    $scope.$watch('volume', function(volume){
        player.updateVolume(volume);
    });
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

.factory('onair', function($rootScope, user, comet, Radio, config){
    var params = {wait: config.cometWait};
    var air = null;

    $rootScope.$watch(function() {
        return user.isLogged();
    }, function(logged){
        if (logged) {
            params.uid = user.get().id;
        } else {
            delete params.uid;
        }
        subscribe();
    });

    $rootScope.$watch(function() { return Radio.current; }, function(radio){
        if (radio) {
            subscribe();
        }
    }, true);

    function onAir(response) {
        air = response.air;
        // force convert to int, onair maybe return id as string
        if (angular.isString(air.id)) {
            air.id = parseInt(air.id, 10);
        }
        $rootScope.$apply();
    }

    function subscribe() {
        if (Radio.current.id) {
            comet.unsubscribe();
            comet.subscribe('/air/' + Radio.current.id, params, onAir);
        }
    }

    return {
        get: function() {
            return air;
        }
    };
})

.controller('PlayerModalCtrl', function($scope, $templateCache){
    $scope.modalSrc = null;

    $scope.$on('showModal', function(ev, src){
        // invalidate template cache
        $templateCache.remove(src);

        $scope.modalSrc = src;
        $scope.$emit('modalShow');
    });

    // empty modal wrapper on close
    $scope.$watch('visible', function(visible){
        if (visible === false) {
            $scope.modalSrc = '';
        }
    });
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

    $scope.showModal = function(modal) {
        $scope.$root.$broadcast('showModal', '/partial/radio/' + Radio.current.id + '/' + modal);
    };


    if (Radio.current.id)
    $scope.showModal('air');
})

.controller('AirHistoryCtrl', function($scope){

});