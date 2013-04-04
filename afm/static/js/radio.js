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

afm.controller('AddCheckCtrl', function($scope){
    $scope.form = {};
    $scope.anySource = function() {
        var form = $scope.form;
        return form.file || form.url || form.text;
    };
});

afm.controller('AddCtrl', function($scope, $http, $window, passErrorToScope){
    $scope.canSave = function() {
        var hasStreams = false;
        angular.forEach($scope.form.streams, function(stream){
            if (stream.use) {
                hasStreams = true;
            }
        });
        return hasStreams && $scope.addForm.$valid && !$scope.error;
    };

    $scope.$watch('form', function(){
        $scope.error = null;
    });

    $scope.save = function() {
        var data = angular.copy($scope.form);
        var streams = [];
        angular.forEach(data.streams, function(stream){
            streams.push(stream.url);
        });
        data.streams = streams;
        console.log(data);
        $http.post('/radio/add/save', data).success(function(resp){
            if (resp.location) {
                $window.location = resp.location;
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

afm.controller('EditCtrl', function($scope, $http){
    $scope.$watch('form', function(){
        $scope.saved = false;
    });

    $scope.save = function() {
        $http.post('/radio/' + $scope.form.id + '/edit', $scope.form).success(function(){
            $scope.saved = true;
        });
    };
});

afm.controller('EditStreamsCtrl', function($scope, $http){

});

afm.controller('EditPlaylistsCtrl', function($scope, $http){

});

afm.directive('tabs', function() {
    return {
        restrict: 'C',
        transclude: true,
        scope: {},
        controller: function($scope) {
            var panes = $scope.panes = [];

            $scope.select = function(pane) {
                angular.forEach(panes, function(pane) {
                    pane.selected = false;
                });
                pane.selected = true;
            };

            this.addPane = function(pane) {
                if (panes.length == 0) {
                    $scope.select(pane);
                }
                panes.push(pane);
            };
        },
        template:
            '<div class="tabbable">' +
                '<ul class="inline nav">' +
                '<li ng-repeat="pane in panes" ng-class="{active:pane.selected}">'+
                '<a href="" ng-click="select(pane)">{{pane.title}}</a>' +
                '</li>' +
                '</ul>' +
                '<div class="tab-content" ng-transclude></div>' +
                '</div>',
        replace: true
    };
});

afm.directive('pane', function() {
    return {
        require: '^tabs',
        restrict: 'C',
        transclude: true,
        scope: {
            title: '@'
        },
        link: function(scope, element, attrs, tabsCtrl) {
            tabsCtrl.addPane(scope);
        },
        template:
            '<div class="tab-pane" ng-class="{active: selected}" ng-transclude></div>',
        replace: true
    };
});


afm.directive('file', function(){
    return {
        scope: {
            file: '='
        },
        link: function(scope, el){
            el.bind('change', function(event){
                var files = event.target.files;
                var file = files[0];
                scope.file = file ? file.name : undefined;
                scope.$apply();
            });
        }
    };
});
