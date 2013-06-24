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
        $scope.radioQuery = '';
        $scope.currentGenre = genre;
        $http.get('/_admin/radio/genre/' + genre.id).success(function(resp){
            $scope.radios = resp.objects;
        });
    };

    $scope.radioClass = function(radio) {
        return {
            selected: $scope.currentRadio && $scope.currentRadio.id == radio.id
        };
    };

    function resetRadio() {
        $scope.radio = null;
        $scope.radioStreams = null;
        $scope.currentRadio = null;
    }

    $scope.selectRadio = function(radio) {
        resetRadio();

        $scope.currentRadio = radio;
        $http.get('/_admin/radio/' + radio.id).success(function(resp){
            $scope.radio = resp.radio;
            $scope.radioStreams = resp.streams;
        });
    };

    $scope.saveRadio = function() {
        var radio = angular.copy($scope.radio);
        $http.post('/_admin/radio/' + radio.id + '/save', {radio: radio}).success(function(resp){
            $scope.radio = resp.radio;
        });
    };

    $scope.deleteRadio = function() {
        $http.post('/_admin/radio/' + $scope.radio.id + '/delete').success(function(){
            // refresh list
            var idx = _.findIndex($scope.radios, {id: $scope.radio.id});
            $scope.radios.splice(idx, 1);
            resetRadio();
        });
    };

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
        $scope.genres.unshift({
            title: 'new',
            is_public: true
        });
    };

    $scope.loadGenres();
})

.controller('StatsCtrl', function($scope, $http, $timeout){
    $scope.stats = {};

    $scope.fetchStats = function() {
        return $http.get('/_admin/stats').success(function(resp){
            $scope.stats = resp.stats;
        });
    };

    function updateLater() {
        $timeout(function () {
            $scope.fetchStats();
            updateLater();
        }, 5000);
    }

    $scope.fetchStats().success(function(){
        updateLater();
    });
})

.directive('inlineEdit', function() {
    return {
        restrict: 'E',
        replace: true,
        template: '<div><span ng-hide="editMode" ng-click="editMode=true" class="inline-edit pseudo-link">{{ model }}</span>' +
                  '<input class="text" ng-model="model" ng-show="editMode" ui-enter="editMode=false" /></div>',
        scope: {
            model: '='
        }
    };
})

.directive('chosen',function(){
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var model = attrs['ngModel'];

            scope.$watch(model, function () {
                element.trigger('liszt:updated');
            });

            element.chosen({
                width: '300px'
            });
        }
    }
})

.filter('fromNow', function() {
    return function(dateString) {
        if (!dateString) {
            return 'never';
        }
        return moment('' + dateString, 'X').fromNow();
    };
});
