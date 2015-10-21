'use strict';

angular.module('rando.detail', ['ui.bootstrap'])
    .controller('DetailController', require('./controllers').DetailController)
    .directive('detailPage',    require('./directives').detailDirective)
    .directive('detailContent', require('./directives').detailContent)
    .directive('detailContentMeta', require('./directives').detailContentMeta)
    .directive('detailContentPictures', require('./directives').detailContentPictures)
    .directive('detailContentElevation', require('./directives').detailContentElevation)
    .directive('detailContentDesks', require('./directives').detailContentDesks)
    .directive('detailAside',   require('./directives').detailAside);
