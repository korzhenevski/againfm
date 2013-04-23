angular.module('afm.sound', [])

.factory('audio', function($document) {
    var audio = $document[0].createElement('audio');
    return audio;
})

.directive('flashEngine', function($window, player){
    $window.flashPlayerCallback = player.flashCallback;
    return {
        restrict: 'C',
        link: function(scope, element, attrs) {
            swfobject.embedSWF(attrs.src, attrs.id, 1, 1, '10', false, {}, {
                allowScriptAccess: 'always',
                wmode: 'transparent'
            }, {});
        }
    };
});