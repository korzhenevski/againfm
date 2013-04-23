angular.module('afm.user', ['afm.base'])

.config(function($routeProvider){
    $routeProvider.when('/login', {controller: 'LoginCtrl', templateUrl: '/login.html', modal: true});
    $routeProvider.when('/signup', {controller: 'SignupCtrl', templateUrl: '/signup.html', modal: true});
    $routeProvider.when('/amnesia', {controller: 'AmnesiaCtrl', templateUrl: '/amnesia.html', modal: true});
    $routeProvider.when('/feedback', {controller: 'FeedbackCtrl', templateUrl: '/feedback.html', modal: true});
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
});