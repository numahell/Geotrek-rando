var utils = require('../../trekking/tests/test_utils.js');

utils.setUp();


casper.test.begin('Tourism Layers', function(test) {

    var home_url = casper.cli.options['url-base'] + '/fr/';

    casper.start(home_url, function () {
         casper.waitForSelector('.tourism-layer-switcher');
    });

    casper.then(function() {
        test.pass('Tourism layer switcher is present');
        test.assertNotExists('.toggle-layer.active',
                             'No layer switcher is active by default.');

        test.assertNotExists('.leaflet-marker-icon.tourism',
                             'Markers are not shown by default.');

        casper.click('.toggle-layer:first-child');
    });

    casper.then(function () {
        test.assertExists('.toggle-layer.active',
                          'Layer toggle is shown active on click');

        test.assertExists('.leaflet-marker-icon.tourism',
                          'Markers are shown on click.');

        casper.click('.leaflet-marker-icon.tourism');
        casper.waitForSelector('.leaflet-popup');
    });

    casper.then(function () {
        test.pass('Popup is shown on marker click');

        test.comment('Open detail page');
        casper.click("a.btn.search");
        casper.waitForSelector('#detailmap');
    });

    casper.then(function () {
        test.assertNotVisible('#detailmap .toggle-layer',
                              'Layer switcher is not shown by default');
        test.assertExists('#detailmap .leaflet-marker-icon.tourism',
                          'Markers state is restored.');
    });

    utils.done(test);
});
