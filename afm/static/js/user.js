angular.module('afm.user', ['afm.base'])

.config(function($routeProvider){
    $routeProvider.when('/login', {controller: 'LoginCtrl', templateUrl: 'login.html', modal: true});
    $routeProvider.when('/signup', {controller: 'SignupCtrl', templateUrl: 'signup.html', modal: true});
    $routeProvider.when('/amnesia', {controller: 'AmnesiaCtrl', templateUrl: 'amnesia.html', modal: true});
    $routeProvider.when('/feedback', {controller: 'FeedbackCtrl', templateUrl: 'feedback.html', modal: true});
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
});