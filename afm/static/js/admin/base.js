angular.module('afm.admin', ['afm.base', 'afm.user'])

.controller('ManagerCtrl', function($scope, $http){
    $scope.loadGenres = function() {
        $scope.genres = $http.get('/_admin/genres').then(function(resp){
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
        return {selected: $scope.currentRadio == radio};
    };

    $scope.selectRadio = function(radio) {
        $scope.currentRadio = radio;

        $scope.radio = null;
        $http.get('/_admin/radio/' + radio.id).success(function(resp){
            $scope.radio = resp.radio;
        });
    };

    $scope.saveRadio = function() {
        $http.post('/_admin/radio/' + $scope.radio.id + '/save', {radio: $scope.radio}).success(function(){

        });
    };

    //$scope.selectRadio({id: 917});

    $scope.loadGenres();
});