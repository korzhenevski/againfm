var afm = angular.module('afm', []);

afm.controller('RadioAddCtrl', function($scope, $http, $window){
    $scope.radio = {
        title: '',
        website: '',
        location: '',
        playlistUrl: [],
        streamUrl: []
    };
    $scope.sourceUrl = null;

    $scope.add = function() {
        $http.post('/radio/add', $scope.radio).success(function(res){
            if (res.location) {
                $window.location = res.location;
            }
        });
    };

    $scope.parsePlaylistSource = function() {
        $scope.parsingSource = true;
        $http.post('/api/parse_playlist_source', {url: $scope.sourceUrl}).success(function(resp){
            $scope.parsingSource = false;
            $scope.radio.playlistUrl = resp.urls;
        });
    };
});