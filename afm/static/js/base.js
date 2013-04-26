angular.module('afm.base', ['ngResource', 'ngCookies'])

.directive('marquee', function($transition){
    return {
        restrict: 'C',
        transclude: true,
        template: '<span class="marquee-scroll" ng-transclude></span>',
        link: function($scope, element) {
            var scroll = element.children('.marquee-scroll');
            var delta = 0;
            var transition;

            element.addClass('marquee-text-overflow');

            function animate() {
                if (transition) {
                    transition.cancel();
                }

                var duration = Math.round(delta * 42 / 1000);
                if (duration < 1) {
                    return;
                }

                element.removeClass('marquee-text-overflow');
                scroll.css({transitionDuration: duration + 's'});

                transition = $transition(scroll, {marginLeft: -delta + 'px'});
                transition.then(function(){
                    transition.cancel();
                    transition = $transition(scroll, {
                        marginLeft: 0,
                        transitionDelay: '1s'
                    });
                    transition.then(animate);
                });
            }

            element.bind('mouseover', function(){
                var scrollWidth = scroll[0].offsetWidth;
                var elementWidth = element[0].offsetWidth;
                delta = scrollWidth > elementWidth ? (scrollWidth - elementWidth) : 0;
                if (delta) {
                    animate();
                }
            });

            element.bind('mouseout', function(){
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

.factory('storage', function($window, $cacheFactory, $log){
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
})

.factory('passErrorToScope', function(){
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

.directive('modalbox', function(){
    return {
        restrict: 'C',
        transclude: true,
        replace: true,
        template: '<div class="modal-box ng-cloak" modalview ng-view ng-show="modalview"></div>'
    };
})


.directive('modalview', function(){
    return {
        restrict: 'A',
        controller: function($scope) {
            $scope.modalview = false;

            this.hide = function() {
                $scope.modalview = false;
            }

            this.show = function() {
                $scope.modalview = true;
            }
        }
    };
})

.directive('modal', function($document, routeHistory){
    return {
        restrict: 'A',
        replace: true,
        transclude: true,
        scope: {
            title: '@'
        },
        require: '^modalview',
        template: '<div class="modal" ui-animate><h1 class="header">{{ title }} <i class="close"></i></h1>' +
                  '<div ng-transclude></div></div>',
        link: function($scope, element, attrs, modalViewCtrl) {
            modalViewCtrl.show();

            element.addClass('modal-' + attrs.modal);
            element.find('i').bind('click', function(){
                routeHistory.backToNotModal();
            });

            // close on escape
            $document.bind('keyup', function(e){
                if (e.keyCode == 27) {
                    routeHistory.backToNotModal();
                }
            });

            $scope.$on('$destroy', function(){
                modalViewCtrl.hide();
                console.log('destroy');
            });
        }
    };
})

.factory('routeHistory', function($rootScope, $route, $location){
    var returnTo = $route.current && !$route.current.$$route.modal ? $location.path() : '/';
    $rootScope.$on('$routeChangeSuccess', function(target, current){
        if (current && current.$$route && !current.$$route.modal) {
            returnTo = $location.path();
        }
    });
    return {
        backToNotModal: function() {
            $location.path(returnTo);
        }
    };
});