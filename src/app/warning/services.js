'use strict';

function WarningService(translationService, settingsFactory, $resource, $http, $q) {
    var self = this;

    this.getWarningCategories = function getWarningCategories (forceRefresh) {
        var deferred = $q.defer();

        if (self._warningCategories && !forceRefresh) {

            deferred.resolve(self._warningCategories);

        } else {
            var currentLang = translationService.getCurrentLang();
            var url = settingsFactory.warningCategoriesUrl.replace(/\$lang/, currentLang);
            var requests = $resource(url, {}, {
                query: {
                    method: 'GET',
                    isArray: true,
                    cache: true
                }
            }, {stripTrailingSlashes: false});

            requests.query().$promise
                .then(function (data) {
                    var categories = angular.fromJson(data);
                    self._warningCategories = categories;
                    deferred.resolve(categories);
                });

        }

        return deferred.promise;
    };

    this.sendWarning = function sendWarning (formData) {

        var currentLang = translationService.getCurrentLang();
        var url = settingsFactory.warningSubmitUrl.replace(/\$lang/, currentLang);

        return $http({
            method: 'POST',
            url: url,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            transformRequest: function(obj) {
                var str = [];
                for(var p in obj) {
                    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
                }
                return str.join("&");
            },
            data: {
                name: formData.name,
                email: formData.email,
                category: formData.category,
                comment: formData.comment,
                geom: '{"type": "Point", "coordinates": [' + formData.location.lng + ',' + formData.location.lat + ']}'
            }
        });
    };
}

function WarningMapService(globalSettings, utilsFactory, iconsService, layersService, mapService, stylesConfigService) {
    var self = this;


    //  CALLBACKS
    //

    this.addCallback = function addCallback (callbackFunction) {
        if (!self.callbacksArray) {
            self.callbacksArray = [];
        }

        self.callbacksArray.push(callbackFunction);
    };

    this.removeCallback = function removeCallback (callbackIndex) {
        self.callbacksArray.splice(callbackIndex, 1);
    };

    this.callCallbacks = function callCallbacks (newLocation) {
        self.callbacksArray.forEach(function (callbackFunction) {
+           callbackFunction(newLocation);
        });
    };


    //  MARKERS
    //

    this.setWarningLocation = function setWarningLocation (newLocation) {
        self.warningMarker.setLatLng(newLocation);
        self.callCallbacks(newLocation);
    };

    this.createWarningMarker = function createWarningMarker (markerLocation) {
        var warningIcon = null;

        iconsService.getWarningIcon()
            .then(function (icon) {
                warningIcon = icon;

                self.warningMarker = L.marker(markerLocation, {
                    icon: warningIcon
                });

                self.warningMarker.addTo(self.map);
            });
    };


    //  CONTROLS
    //

    this.initMapControls = function initMapControls () {
        self.setAttribution();
        self.setZoomControlPosition();
        self.initCustomsMixins();
        self.createLayerSwitch();
    };

    this.setZoomControlPosition = function setZoomControlPosition () {
        self.map.zoomControl.setPosition('topright');
    };

    this.setAttribution = function setAttribution () {
        self.map.attributionControl.setPrefix(globalSettings.LEAFLET_CONF.ATTRIBUTION);
    };


    //  MAP
    //

    this.getMap = function getMap (mapSelector, element) {
        if (self.map) {
            return self.map;
        } else {
            return self.createMap(mapSelector, element);
        }
    };

    this.removeMap = function removeMap () {
        if (self.map) {
            self.map.remove();
            self.map = null;
        }
    };

    this.createMap = function createMap (mapSelector, element) {
        self._baseLayers = {
            main: layersService.getMainLayersGroup(),
            satellite: L.tileLayer(
                globalSettings.ORTHOPHOTO_TILELAYERS.LAYER_URL,
                globalSettings.ORTHOPHOTO_TILELAYERS.OPTIONS
            )
        };

        var elementLocation = utilsFactory.getStartPoint(element);

        var mapParameters = {
            center: elementLocation,
            zoom: globalSettings.LEAFLET_CONF.DEFAULT_ZOOM,
            minZoom: globalSettings.LEAFLET_CONF.DEFAULT_MIN_ZOOM,
            maxZoom: globalSettings.LEAFLET_CONF.DEFAULT_MAX_ZOOM,
            scrollWheelZoom: true,
            layers: self._baseLayers.main
        };
        self.map = L.map(mapSelector, mapParameters);
        self.initMapControls();
        self.createWarningMarker(elementLocation);

        self.map.on('click', function(e) {
            self.setWarningLocation(e.latlng);
        });

        if (globalSettings.ENABLE_TREKS) {
            self._treksgeoJsonLayer = mapService.createGeoJSONLayer();
        }

        return self.map;
    };

    this.initCustomsMixins = function initCustomsMixins () {
        this.addMapLayersMixin();
    };

    this.addMapLayersMixin = function addMapLayersMixin () {
        var LayerSwitcherMixin = {

            isShowingLayer: function (name) {
                if (this.hasLayer(self._baseLayers[name])) {
                    return true;
                }
                return false;
            },

            switchLayer: function (destLayer) {
                var base;
                for (base in self._baseLayers) {
                    if (this.hasLayer(self._baseLayers[base]) && self._baseLayers[base] !== self._baseLayers[destLayer]) {
                        this.removeLayer(self._baseLayers[base]);
                    }
                }
                this.addLayer(self._baseLayers[destLayer]);
            }
        };

        L.Map.include(LayerSwitcherMixin);
    };

    this.createLayerSwitch = function createLayerSwitch () {

        var permanentTileLayersName   = globalSettings.PERMANENT_TILELAYERS_NAME  || 'Default';
        var orthophotoTileLayersName  = globalSettings.ORTHOPHOTO_TILELAYERS_NAME || 'Satellite';
        var permanentTileLayersParam  = {};

        permanentTileLayersParam[permanentTileLayersName]  = this._baseLayers.main;
        permanentTileLayersParam[orthophotoTileLayersName] = this._baseLayers.satellite;

        var layersControl = L.control.switchBackgroundLayers(
            permanentTileLayersParam,
            { position: 'bottomleft' }
        );

        var optionalLayersControl = L.control.backgroundLayers(
            this._optionalLayers,
            { position: 'bottomleft' }
        );

        layersControl.addTo(this.map);
        optionalLayersControl.addTo(this.map);
        return true;
    };




    this.displayDetail = function displayDetail (result, forceRefresh) {
        var type = '',
            elementLocation,
            currentLayer;

        self.maxZoomFitting = globalSettings.DEFAULT_MAX_ZOOM;

        // self.map.off('moveend', self.resultsVisibility);

        // self.loadingMarkers = true;
        if (result.geometry.type !== "Point" && result.geometry.type !== "MultiPoint") {
            currentLayer = self._treksgeoJsonLayer;
            type = 'geojson';
            elementLocation = [];
        }

        mapService.createLayerFromElement(result, type, elementLocation, forceRefresh)
            .then(
                function (layer) {
                    currentLayer.addLayer(layer);
                    if (result.geometry.type !== "Point" && result.geometry.type !== "MultiPoint") {
                        if (globalSettings.SHOW_ARROWS_ON_ROUTE) {
                            var className;
                            if (stylesConfigService.isConfigAvailable) {
                                className = 'arrow-direction category-' + result.properties.category.id + '-fill-darken';
                            } else {
                                className = 'arrow-direction category-' + result.properties.category.id;
                            }
                            layer.setText('  >  ', {offset: 6, repeat: true, center: true, attributes: {class: className}});
                        }
                        if (globalSettings.ALWAYS_HIGHLIGHT_TREKS) {
                            mapService.highlightPath(result, true, true);
                        }

                        var bounds;
                        if (!(currentLayer instanceof Array)) {
                            currentLayer = [currentLayer];
                        }
                        currentLayer.forEach(function (layer) {
                            var currentBounds = layer.getBounds();
                            if (bounds && bounds.extend) {
                                bounds.extend(currentBounds);
                            } else {
                                bounds = currentBounds;
                            }
                        });
                        var fitBoundsOptions = {
                            padding: 0,
                            maxZoom: self.maxZoomFitting,
                            animate: false
                        };
                        self.map.fitBounds(bounds, fitBoundsOptions);
                        self.map.addLayer(self._treksgeoJsonLayer);
                    }
                }
            );
    };
}

module.exports = {
    WarningService: WarningService,
    WarningMapService: WarningMapService
};
