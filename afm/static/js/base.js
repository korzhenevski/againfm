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

.factory('user', function(){
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
})

.factory('User', ['$http', function($http){
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
}])

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