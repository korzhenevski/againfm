afm.directive('uiAnimate', ['$timeout', function ($timeout) {
    return {
        restrict: 'A', // supports using directive as element, attribute and class
        link: function ($scope, element, attrs) {
            var opts = {};
            if (attrs.uiAnimate) {
                opts = $scope.$eval(attrs.uiAnimate);
                if (angular.isString(opts)) {
                    opts = {'class': opts};
                }
            }
            opts = angular.extend({'class': 'ui-animate'}, opts);

            element.addClass(opts['class']);
            $timeout(function () {
                element.removeClass(opts['class']);
            }, 20);
        }
    };
}]);