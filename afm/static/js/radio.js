var afm = angular.module('afm', ['ngResource', 'ngCookies']);

afm.factory('passErrorToScope', function(){
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
});

afm.controller('AddCtrl', function($scope, $http, $window, passErrorToScope){
    $scope.$watch('form', function(){
        $scope.error = null;
    }, true);

    $scope.add = function() {
        $http.post('/radio/add', $scope.form).success(function(res){
            if (res.location) {
                $window.location = res.location;
            }
        }).error(passErrorToScope($scope));
    };
});

afm.controller('EditGenresCtrl', function($scope, $http){
    $scope.searchQuery = '';
    $scope.reset = function() {
        $http.get('/api/radio/genres/edit').success(function(resp){
            $scope.genres = resp.genres;
        });
    };

    $scope.save = function() {
        $scope.saving = true;
        $http.post('/api/radio/genres/edit', {genres: $scope.genres}).success(function(resp){
            $scope.saving = false;
            $scope.genres = resp.genres;
        });
    };

    $scope.reset();
});

afm.directive('ngEnter', function() {
    return function(scope, elm, attrs) {
        elm.bind('keypress', function(e) {
            if (e.charCode === 13) scope.$apply(attrs.ngEnter);
        });
    };
});

afm.directive('inlineEdit', function() {
    return {
        restrict: 'E',
        replace: true,
        template: '<div><span ng-hide="editMode" ng-click="editMode=true;value=model">{{ model }}</span>' +
                  '<input class="text" ng-model="model" ng-show="editMode" ng-enter="editMode=false" /></div>',
        scope: {
            model: '='
        }
    };
});

afm.controller('EditCtrl', function($scope){

});

afm.controller('EditStreamsCtrl', function($scope, $http){

});

afm.controller('EditPlaylistsCtrl', function($scope, $http){

});