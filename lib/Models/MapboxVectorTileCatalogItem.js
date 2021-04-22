const MapboxVectorTileImageryProvider = require("../Map/MapboxVectorTileImageryProvider");
const clone = require("terriajs-cesium/Source/Core/clone").default;
const defined = require("terriajs-cesium/Source/Core/defined").default;
const ImageryLayerFeatureInfo = require("terriajs-cesium/Source/Scene/ImageryLayerFeatureInfo")
  .default;
const ImageryLayerCatalogItem = require("./ImageryLayerCatalogItem");
var Resource = require("terriajs-cesium/Source/Core/Resource").default;
const inherit = require("../Core/inherit");
const knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
const Legend = require("../Map/Legend");
const overrideProperty = require("../Core/overrideProperty");
var i18next = require("i18next").default;

/**
 * A {@link ImageryLayerCatalogItem} representing a rasterised Mapbox vector tile layer.
 *
 * @alias MapboxVectorTileCatalogItem
 * @constructor
 * @extends ImageryLayerCatalogItem
 *
 * @param {Terria} terria The Terria instance.
 */
const MapboxVectorTileCatalogItem = function(terria) {
  ImageryLayerCatalogItem.call(this, terria);

  /**
   * Gets or sets the outline color of the features, specified as a CSS color string.
   * @type {String}
   * @default '#519AC2'
   */
  this.lineColor = "#519AC2";

  /**
   * Gets or sets the fill color of the features, specified as a CSS color string.
   * @type {String}
   * @default 'rgba(0,0,0,0)'
   */
  this.fillColor = "rgba(0,0,0,0)";

  /**
   * Gets or sets the name of the layer to use the Mapbox vector tiles.
   * @type {String}
   */
  this.layer = undefined;

  /**
   * Gets or sets the name of the property that is a unique ID for features.
   * @type {String}
   * @default 'FID'
   */
  this.idProperty = "FID";

  /**
   * Gets or sets the name of the property from which to obtain the name of features.
   * @type {String}
   */
  this.nameProperty = undefined;

  /**
   * Gets or sets the maximum zoom level for which tile files exist.
   * @type {Number}
   * @default 12
   */
  this.maximumNativeZoom = 12;

  /**
   * Gets or sets the maximum zoom level that can be displayed by using the data in the
   * {@link MapboxVectorTileCatalogItem#maximumNativeZoom} tiles.
   * @type {Number}
   * @default 28
   */
  this.maximumZoom = 28;

  /**
   * Gets or sets the minimum zoom level for which tile files exist.
   * @type {Number}
   * @default 0
   */
  this.minimumZoom = 0;
  this._legendUrl = undefined;
  this._metadata = undefined;

  knockout.track(this, [
    "fillColor",
    "lineColor",
    "lineWidth",
    "lineJoin",
    "layer",
    "idProperty",
    "nameProperty",
    "_legendUrl"
  ]);

  knockout.getObservable(this, "fillColor").subscribe(function() {
    updateOpacity(this);
  }, this);

  knockout.getObservable(this, "lineColor").subscribe(function() {
    updateOpacity(this);
  }, this);

  knockout.getObservable(this, "lineWidth").subscribe(function() {
    updateOpacity(this);
  }, this);

  knockout.getObservable(this, "lineJoin").subscribe(function() {
    updateOpacity(this);
  }, this);

  // metadataUrl and legendUrl are derived from url if not explicitly specified.
  overrideProperty(this, "metadataUrl", {
    get: function() {
      if (defined(this._metadataUrl)) {
        return this._metadataUrl;
      }

      return cleanUrl(this.url);
    },
    set: function(value) {
      this._metadataUrl = value;
    }
  });

  overrideProperty(this, "legendUrl", {
    get: function() {
      if (defined(this._legendUrl)) {
        return this._legendUrl;
      } else {
        return new Legend({
          items: [
            {
              color: this.fillColor,
              lineColor: this.lineColor,
              title: this.name
            }
          ]
        }).getLegendUrl();
      }
    },
    set: function(value) {
      this._legendUrl = value;
    }
  });
};

function updateOpacity(item) {
  if (defined(item._imageryLayer) && item.isEnabled && item.isShown) {
    if (defined(item._imageryLayer.alpha)) {
      item._imageryLayer.alpha = item.opacity;
    }
    if (defined(item._imageryLayer.setOpacity)) {
      item._imageryLayer.setOpacity(item.opacity);
    }
    item.terria.currentViewer.notifyRepaintRequired();
  }
}

inherit(ImageryLayerCatalogItem, MapboxVectorTileCatalogItem);

Object.defineProperties(MapboxVectorTileCatalogItem.prototype, {
  /**
   * Gets the type of data item represented by this instance.
   * @memberOf MapboxVectorTileCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "mvt";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, 'Mapbox Vector Tile'.
   * @memberOf MapboxVectorTileCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.mapboxVectorTile.name");
    }
  },

  metadata: {
    get: function() {
      return this._metadata
    }
  }
});

MapboxVectorTileCatalogItem.prototype._load = function() {
  // console.log("MapboxVectorTileCatalogItem.prototype._load", this.metadataUrl)

  if (!defined(this._metadataUrl)) {
    return;
  }

  // const queryParameters = {};
  // if (this.auth_token) {
  //   queryParameters.auth_token = this.auth_token;
  // }

  const resource = new Resource({
    url: this._metadataUrl,
    // headers: {
    //   "Content-Type": "application/json"
    // },
    // queryParameters: queryParameters
  });

  return resource.fetch(/* JSON.stringify(this.config || {}) */).then(response => {
    const json = JSON.parse(response);
    if (json) {
      // console.log("load", {json})
      this._metadata = _.get(json, 'featureTypes[0].properties', {})
    } else {
      throw new TerriaError({
        sender: this,
        title: i18next.t("models.cartoMap.noUrlTitle"),
        message: i18next.t("models.cartoMap.noUrlMessage")
      });
    }
  });
};

MapboxVectorTileCatalogItem.prototype._createImageryProvider = function() {
  return new MapboxVectorTileImageryProvider({
    url: this.url,
    layerName: this.layer,
    styleFunc: () => ({
      fillStyle: this.fillColor,
      strokeStyle: this.lineColor,
      lineWidth: 1
    }),
    rectangle: this.rectangle,
    minimumZoom: this.minimumZoom,
    maximumNativeZoom: this.maximumNativeZoom,
    maximumZoom: this.maximumZoom,
    uniqueIdProp: this.idProperty,
    featureInfoFunc: feature => featureInfoFromFeature(this, feature)
  });
};

function featureInfoFromFeature(mapboxVectorTileCatalogItem, feature) {
  const featureInfo = new ImageryLayerFeatureInfo();
  if (defined(mapboxVectorTileCatalogItem.nameProperty)) {
    featureInfo.name =
      feature.properties[mapboxVectorTileCatalogItem.nameProperty];
  }
  featureInfo.properties = clone(feature.properties);
  featureInfo.data = {
    id: feature.properties[mapboxVectorTileCatalogItem.idProperty]
  }; // For highlight
  return featureInfo;
}

module.exports = MapboxVectorTileCatalogItem;
