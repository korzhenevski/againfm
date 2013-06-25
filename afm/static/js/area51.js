angular.module('afm.area51', ['afm.base', 'afm.user', 'afm.sound'])

.controller('AreaFiftyOneCtrl', function($scope, flash, audioEngine){
    $scope.data = {
        flash: flash.present(),
        flashVersion: swfobject.getFlashPlayerVersion(),
        html5: audioEngine(function(){}).html5,
        userAgent: navigator.userAgent,
        localStorage: !!window.localStorage
    };
});
