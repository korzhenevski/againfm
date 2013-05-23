angular.module('afm.base', ['ngResource', 'ngCookies', 'ui.state'])

.config(function($locationProvider){
    $locationProvider.html5Mode(true);
})

.factory('config', function () {
    return {
        cometWait: 25,
        marqueeSpeed: 45
    }
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
                }, 500);
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
                if (angular.isUndefined(from.templateUrl) && angular.isDefined(to.templateUrl)) {
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