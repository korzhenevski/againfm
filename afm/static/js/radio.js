var afm = angular.module('afm', ['ngResource']);

/*
afm.directive('player', function($document){
    return {
        restrict: 'E',
        template: '<div></div>',
        link: function(scope, element, attrs) {
            console.log(arguments);
        }
    }
});*/

afm.controller('PlaylistCtrl', function($scope, $resource){
    $scope.filters = [
        {id: 'featured', title: 'Подборка'},
        {id: 'genre/trance', title: 'Транс'},
        {id: 'genre/house', title: 'Хауз'},
        {id: 'genre/dnb', title: 'Драм-н-бейс'},
        {id: 'genre/pop', title: 'Поп'},
        {id: 'genre/metal', title: 'Метал'},
        {id: 'genre/news', title: 'Новости'},
        {id: 'genre/chillout', title: 'Чилаут'}
    ];

    // TODO(outself): rename filter for anything for proper semantics
    $scope.playlist = [];
    $scope.currentFilter = null;
    var Playlist = $resource('/api/playlist/:filter');

    $scope.selectFilter = function(filter) {
        $scope.playlist = [];
        Playlist.get({filter: filter.id}, function(response){
            $scope.playlist = response.objects;
        });
        $scope.currentFilter = filter;
    };

    $scope.filterClass = function(filter) {
        var selected = $scope.currentFilter && $scope.currentFilter.id == filter.id;
        return {selected: selected};
    };

    $scope.selectFilter($scope.filters[0]);
});