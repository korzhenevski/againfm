angular.module('afm.sound', [])

.factory('audio', ['$document', function($document) {
    var audio = $document[0].createElement('audio');
    return audio;
}])

.directive('flashEngine', ['$window', 'player', function($window, player){
    $window.flashPlayerCallback = player.flashCallback;
    return {
        restrict: 'C',
        link: function(scope, element, attrs) {
            // TODO: move swfobject to provider
            swfobject.embedSWF(attrs.src, attrs.id, 1, 1, '10', false, {}, {
                allowScriptAccess: 'always',
                wmode: 'transparent'
            }, {});
        }
    };
}]);