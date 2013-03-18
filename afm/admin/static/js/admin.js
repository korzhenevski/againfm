var admin = angular.module('admin', ['ngResource']);

admin.factory('Radio', function($resource){
    return $resource('/admin/api/radio/:_id', {}, {
        list: {method: 'GET'}
    });
});

admin.controller('RadioCtrl', function($scope, Radio, $http){
    Radio.list(function(response){
        $scope.radio_list = response['objects'];
    });

    $scope.markGroup = function(radio) {
        radio.group = !radio.group;
        $http.post('/admin/api/radio/' + radio._id + '/group', {group: radio.group});
    };
});