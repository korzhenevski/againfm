var afm = angular.module('afm', []);

afm.controller('PlaylistCtrl', function($scope){
    $scope.filters = [
        {title: 'Подборка', selected: true},
        {title: 'Транс'},
        {title: 'Хауз'},
        {title: 'Джаз'}
    ];

    $scope.playlist = [
        { "id" : 30, "title" : "Deep Nu-Disco" },
        { "id" : 13, "title" : "Covers" },
        { "id" : 68, "title" : "DI - Chiptunes" },
        { "id" : 35, "title" : "Hard Dance" },
        { "id" : 20, "title" : "cliqhop idm" },
        { "id" : 60, "title" : "DI - Classic EuroDance" },
        { "id" : 70, "title" : "42FM" },
        { "id" : 86, "title" : "hirschmilch - electronic" },
        { "id" : 64, "title" : "DI - Dubstep", selected: true },
        { "title" : "Again.FM best radio", "id" : 75 },
        { "title" : "iwayhigh - dub electro chill", "id" : 81 },
        { "id" : 83, "title" : "hirschmilch - progressive" },
        { "id" : 84, "title" : "hirschmilch - progressive house" },
        { "id" : 8, "title" : "Soma - Digitalis" },
        { "title" : "DI - Latin House", "id" : 66 },
        { "title" : "Tech House", "id" : 56 },
        { "id" : 44, "title" : "Classic Electronica" },
        { "title" : "Garage.FM", "id" : 73 },
        { "id" : 1, "title" : "Afterhours" }
    ];
});