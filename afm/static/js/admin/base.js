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
        var radio = angular.copy($scope.radio);
        $http.post('/_admin/radio/' + radio.id + '/save', {radio: radio}).success(function(resp){
            $scope.radio = resp.radio;
        });
    };

    $scope.selectRadio({id: 917});
    $scope.loadGenres();

})


.filter('fromNow', function() {
    return function(dateString) {
        if (!dateString) {
            return 'never';
        }
        return moment('' + dateString, 'X').fromNow();
    };
});
