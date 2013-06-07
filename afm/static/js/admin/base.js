angular.module('afm.admin', ['afm.base', 'afm.user'])

.controller('ManagerCtrl', function($scope, $http){
    $scope.loadGenres = function() {
        $scope.genres = $http.get('/_admin/genres/nav').then(function(resp){
            return resp.data.genres;
        });
    };

    $scope.currentGenre = null;
    $scope.currentRadio = null;

    $scope.genreClass = function(genre) {
        return {selected: $scope.currentGenre == genre};
    };

    $scope.selectGenre = function(genre) {
        $scope.currentGenre = genre;
        $scope.radios = $http.get('/_admin/radio/genre/' + genre.id).then(function(resp){
            return resp.data.objects;
        });
    };

    $scope.radioClass = function(radio) {
        return {
            selected: $scope.currentRadio && $scope.currentRadio.id == radio.id,
            nopub: !radio.is_public
        };
    };

    $scope.selectRadio = function(radio) {
        $scope.currentRadio = radio;

        $scope.radio = null;
        $http.get('/_admin/radio/' + radio.id).success(function(resp){
            $scope.radio = resp.radio;
        });
    };

    $scope.saveRadio = function() {
        var radio = angular.copy($scope.radio);
        $http.post('/_admin/radio/' + radio.id + '/save', {radio: radio}).success(function(resp){
            $scope.radio = resp.radio;
        });
    };

    //$scope.selectRadio({id: 917});
    $scope.loadGenres();
})

.controller('GenresCtrl', function($scope, $http){
    $scope.loadGenres = function() {
        $http.get('/_admin/genres').success(function(resp){
            $scope.genres = resp.genres;
        });
    };

    $scope.save = function() {
        $http.post('/_admin/genres/save', {genres: $scope.genres}).success(function(resp){
            $scope.genres = resp.genres;
        });
    };

    $scope.new = function() {
        $scope.genres.unshift({title: 'new', is_public: true});
    };

    $scope.loadGenres();
})

.directive('inlineEdit', function() {
    return {
        restrict: 'E',
        replace: true,
        template: '<div><span ng-hide="editMode" ng-click="editMode=true" class="inline-edit">{{ model }}</span>' +
                  '<input class="text" ng-model="model" ng-show="editMode" ui-enter="editMode=false" /></div>',
        scope: {
            model: '='
        }
    };
})

.filter('fromNow', function() {
    return function(dateString) {
        if (!dateString) {
            return 'never';
        }
        return moment('' + dateString, 'X').fromNow();
    };
});
