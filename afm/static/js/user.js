angular.module('afm.user', ['afm.base'])

.config(function($stateProvider){
    $stateProvider.state('login', {
        url: '/login',
        templateUrl: 'login.html',
        controller: 'LoginCtrl'
    });

    $stateProvider.state('signup', {
        url: '/signup',
        templateUrl: 'signup.html',
        controller: 'SignupCtrl'
    });

    $stateProvider.state('amnesia', {
        url: '/amnesia',
        templateUrl: 'amnesia.html',
        controller: 'AmnesiaCtrl'
    });
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
        },

        feedback: function(params) {
            return $http.post('/api/user/feedback', params);
        }
    };
}])

.controller('UserCtrl', function($scope, User, user) {
    $scope.user = user;
    $scope.logout = function() {
        if (user.isLogged()) {
            user.clear();
            User.logout();
        }
    };

    $scope.setUser = function(newUser) {
        user.update(newUser);
    };
})

.directive('userForm', function(){
    return {
        restrict: 'A',
        controller: function($scope, user) {
            $scope.user = user;

            $scope.$watch('data', function(){
                $scope.error = false;
            }, true);

            $scope.submit = function() {
                $scope.error = false;
                $scope.showErrors = true;

                $scope.send().error(function(response, statusCode){
                    var error = {};
                    if (angular.isObject(response) && response.error) {
                        error.reason = response.error;
                    }
                    error.code = statusCode;
                    $scope.error = error;
                });
            };
        }
    }
})

.controller('LoginCtrl', function($scope, $window, User){
    $scope.data = {};

    $scope.send = function() {
        return User.login($scope.data).success(function(){
            $window.location = '/';
        });
    };
})

.controller('SignupCtrl', function($scope, $window, User){
    $scope.data = {};

    $scope.send = function() {
        return User.signup($scope.data).success(function(){
            $window.location = '/';
        });
    };
})

.controller('AmnesiaCtrl', function($scope, User){
    $scope.data = {};

    $scope.send = function() {
        return User.amnesia($scope.data).success(function(result){
            $scope.result = result;
        });
    };
})

.controller('FeedbackCtrl', function($scope, user, User){
    $scope.data = {};

    if (user.isLogged()) {
        $scope.data.email = user.get().email;
    }

    $scope.send = function() {
        $scope.result = false;
        return User.feedback($scope.data).success(function(result){
            $scope.result = result;
        });
    };
});
