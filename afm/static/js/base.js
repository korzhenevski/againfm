angular.module('afm.base', ['ngResource', 'ngCookies', 'ui.state'])

.factory('config', function () {
    return {
        cometWait: 30,
        marqueeSpeed: 35,
        listenHistorySize: 20,
        defaultVolume: 0.6
    }
})

.directive('flashMessage', function(storage){
    return {
        restrict: 'C',
        link: function($scope, element) {
            $scope.hideFlash = function() {
                element.css('display', 'none');
                storage.put('hideFlashMessage', true);
            };

            element.css('display', storage.get('hideFlashMessage') ? 'none' : 'block');
        }
    }
})

.directive('uiEnter', function() {
    return function(scope, elm, attrs) {
        elm.bind('keypress', function(e) {
            if (e.charCode === 13) {
                scope.$apply(attrs.uiEnter);
            }
        });
    };
})

.directive('marquee', function ($transition, $timeout, config) {
    return {
        restrict: 'C',
        transclude: true,
        template: '<span class="marquee-scroll" ng-transclude></span>',
        link: function ($scope, element) {
            var scroll = element.children('.marquee-scroll');
            var delta = 0;
            var transition;

            element.addClass('marquee-text-overflow');

            function animate() {
                if (transition) {
                    transition.cancel();
                }

                var duration = Math.round(delta * config.marqueeSpeed / 1000);
                element.removeClass('marquee-text-overflow');
                scroll.css({transitionDuration: duration + 's'});

                transition = $transition(scroll, {marginLeft: -delta + 'px'});
                transition.then(function () {
                    transition.cancel();
                    transition = $transition(scroll, {
                        marginLeft: 0,
                        transitionDelay: '1s'
                    });
                    transition.then(animate);
                });
            }

            var startThrottle;
            element.bind('mouseover', function () {
                if (startThrottle) {
                    $timeout.cancel(startThrottle);
                }

                startThrottle = $timeout(function(){
                    var scrollWidth = scroll[0].offsetWidth;
                    var elementWidth = element[0].offsetWidth;
                    delta = scrollWidth > elementWidth ? (scrollWidth - elementWidth) : 0;
                    if (delta) {
                        animate();
                    }
                }, 300);
            });

            element.bind('mouseout', function () {
                if (startThrottle) {
                    $timeout.cancel(startThrottle);
                }

                if (transition) {
                    transition.cancel();
                }

                element.addClass('marquee-text-overflow');
                scroll.css({
                    transitionDuration: 0,
                    transitionDelay: 0,
                    marginLeft: 0
                });
            });
        }
    };
})

.factory('trackEvent', function($http, user){
    return function(name, data) {
        var userId = user.isLogged() ? user.id : -1;
        var params = angular.extend({}, data, {uid: userId});
        console.log('event '+name, params);
        $http.post('/_event/' + name, params);
    };
})

.factory('title', function($document){
    var def = $document[0].title;
    return {
        current: def,
        change: function(title) {
            this.current = title;
            $document[0].title = title;
        },

        reset: function() {
            this.change(def);
        }
    }
})

.factory('storage', function ($window, $cacheFactory, $log) {
    try {
        // test localStorage
        var storage = $window.localStorage;
        if (storage) {
            storage.setItem('key', 'value');
            storage.removeItem('key');
            return {
                put: function (key, value) {
                    storage.setItem(key, angular.toJson(value));
                },

                get: function (key) {
                    return angular.fromJson(storage.getItem(key));
                },

                remove: function (key) {
                    storage.removeItem(key);
                }
            };
        }
    } catch (e) {
    }
    // fallback
    $log.warn('localStorage not available. fallback used.');
    return $cacheFactory('storage');
})

.provider('cacheFactory', function() {
    this.$get = function () {
        var caches = {};

        function cacheFactory(cacheId, options) {
            if (cacheId in caches) {
                throw Error('cacheId ' + cacheId + ' taken');
            }

            var size = 0,
                stats = angular.extend({}, options, {id: cacheId}),
                data = {},
                capacity = (options && options.capacity) || Number.MAX_VALUE,
                lruHash = {},
                persistentStorage = options && options.persistent,
                freshEnd = null,
                staleEnd = null;

            caches[cacheId] = {
                put: function (key, value) {
                    var lruEntry = lruHash[key] || (lruHash[key] = {key: key});

                    refresh(lruEntry);

                    if (angular.isUndefined(value)) return;
                    if (!(key in data)) size++;
                    data[key] = value;

                    if (size > capacity) {
                        this.remove(staleEnd.key);
                    } else {
                    	sync();
                    }
                },

                get: function (key) {
                    var lruEntry = lruHash[key];
                    if (!lruEntry) return;
                    refresh(lruEntry);
                    return data[key];
                },

                remove: function (key) {
                    var lruEntry = lruHash[key];

                    if (!lruEntry) return;

                    if (lruEntry == freshEnd) freshEnd = lruEntry.p;
                    if (lruEntry == staleEnd) staleEnd = lruEntry.n;
                    link(lruEntry.n, lruEntry.p);

                    delete lruHash[key];
                    delete data[key];
                    size--;

                    sync();
                },

                removeAll: function () {
                    data = {};
                    size = 0;
                    lruHash = {};
                    freshEnd = staleEnd = null;

                    sync();
                },

                destroy: function () {
                    data = null;
                    stats = null;
                    lruHash = null;
                    delete caches[cacheId];

                    if (persistentStorage) {
                        persistentStorage.remove(cacheId);
                    }
                },

                getData: function() {
                    return data;
                },

                exists: function(key) {
                    return key in data;
                },

                info: function () {
                    return angular.extend({}, stats, {size: size});
                }
            };

            if (persistentStorage) {
                angular.forEach(persistentStorage.get(cacheId) || {}, function(value, key){
                    caches[cacheId].put(key, value);
                });
            }
            return caches[cacheId];

            function sync() {
                if (persistentStorage) {
                    persistentStorage.put(cacheId, data);
                }
            }

            /**
             * makes the `entry` the freshEnd of the LRU linked list
             */

            function refresh(entry) {
                if (entry != freshEnd) {
                    if (!staleEnd) {
                        staleEnd = entry;
                    } else if (staleEnd == entry) {
                        staleEnd = entry.n;
                    }

                    link(entry.n, entry.p);
                    link(entry, freshEnd);
                    freshEnd = entry;
                    freshEnd.n = null;
                }
            }


            /**
             * bidirectionally links two entries of the LRU linked list
             */

            function link(nextEntry, prevEntry) {
                if (nextEntry != prevEntry) {
                    if (nextEntry) nextEntry.p = prevEntry; //p stands for previous, 'prev' didn't minify
                    if (prevEntry) prevEntry.n = nextEntry; //n stands for next, 'next' didn't minify
                }
            }
        }

        cacheFactory.info = function () {
            var info = {};
            angular.forEach(caches, function (cache, cacheId) {
                info[cacheId] = cache.info();
            });
            return info;
        };

        cacheFactory.get = function (cacheId) {
            return caches[cacheId];
        };

        return cacheFactory;
    };
})

.factory('passErrorToScope', function () {
    return function ($scope) {
        return function (response, statusCode) {
            var error = {};
            if (angular.isObject(response) && response.error) {
                error.reason = response.error;
            }
            error.code = statusCode;
            $scope.error = error;
        };
    };
})

.directive('modalBack', function ($document, $location, $rootElement, $state, $window) {
    return {
        restrict: 'C',
        scope: {},
        controller: function ($scope) {
            this.hide = function () {
                $scope.visible = false;
            };

            this.show = function () {
                $scope.visible = true;
            };
        },

        link: function ($scope, element) {
            var backTo = {};

            $scope.closeModal = function(skipApply) {
                if (!$scope.visible) {
                    return;
                }

                $scope.visible = false;
                if (!skipApply) {
                    $scope.$apply();
                }
            };

            $scope.reload = function() {
                $scope.visible = false;
                setTimeout(function(){
                    $window.location = $window.location;
                }, 10);
            };

            $scope.$on('$stateChangeStart', function(ev, to, toParams, from, fromParams){
                if (angular.isUndefined(from.templateUrl) && (angular.isDefined(to.templateUrl) || angular.isDefined(to.templateProvider))) {
                    backTo = {name: from.name, params: fromParams};
                }
            });

            $scope.$watch('visible', function (visible) {
                if (visible === false) {
                    if (backTo.name) {
                        $state.transitionTo(backTo.name, backTo.params);
                    } else {
                        $state.transitionTo('home');
                    }
                    backTo = {};
                }
            });

            $scope.$on('modalShow', function(){
                $scope.visible = true;
            });

            element.bind('click', function (e) {
                // close by click only to modalBack
                if (e.target == element[0]) {
                    $scope.closeModal();
                }
            });

            $rootElement.bind('keydown', function (e) {
                // Press Escape
                if (e.which === 27) {
                    $scope.closeModal();
                }
            });
        }
    };
})

.factory('collectionFactory', function (cacheFactory, storage) {
    return function (cacheId, options) {
        options = angular.extend({}, options, {persistent: storage});
        var cache = cacheFactory(cacheId, options);
        return {
            add: function(key, value) {
                cache.put(key, angular.extend({}, value, {ts: +(new Date())}));
            },

            remove: function(key) {
                cache.remove(key);
            },

            list: function() {
                return _.sortBy(_.values(cache.getData()), 'ts').reverse();
            },

            getData: function() {
                return cache.getData();
            },

            isEmpty: function() {
                return _.isEmpty(cache.getData());
            },

            exists: function(key) {
                return cache.exists(key);
            },

            removeAll: function() {
                cache.removeAll();
            }
        };
    };
})

.directive('modal', function () {
    return {
        require: '^modalBack',
        restrict: 'A',
        replace: true,
        transclude: true,
        template: '<div class="modal">' +
            '<h1 class="header">{{ title }} <i class="close" ng-click="close()"></i></h1>' +
            '<div ng-transclude></div></div>',
        scope: {
            title: '@'
        },

        link: function ($scope, element, attrs, back) {
            back.show();

            if (attrs.modal) {
                element.addClass('modal-' + attrs.modal);
            }

            $scope.close = function () {
                back.hide();
            };
        }
    };
});