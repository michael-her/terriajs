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

import {
  LAYER_VIS_CONFIGS,
  DEFAULT_TEXT_LABEL,
  DEFAULT_COLOR_UI,
  UNKNOWN_COLOR_KEY
} from '../layers/layer-factory';
const {default: Layer, baseVisualChannels} = require("../Layers/base-layer")
import {
  DEFAULT_AGGREGATION, SCALE_TYPES, GEOJSON_FIELDS, HIGHLIGH_COLOR_3D, CHANNEL_SCALES, FIELD_OPTS
} from "../Constants/default-settings"
import {COLOR_RANGES} from '../Constants/color-ranges';

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
   * @default 'rgba(0, 0, 0, 0)'
   */
  this.fillColor = "rgba(0, 0, 0, 0)";

  /**
   * Gets or sets the outline width of the features, specified in pixels.
   * @type {number}
   * @default 1.0
   */
  this.lineWidth = 1.0;

  /**
   * Gets or sets the outline join of the features, in ['bevel' || 'round' || 'miter']
   * @type {String}
   * @default 'round'
   */
  this.lineJoin = "round";

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

  knockout.getObservable(this, "fillColor").subscribe(this.refresh, this);

  knockout.getObservable(this, "lineColor").subscribe(this.refresh, this);

  knockout.getObservable(this, "lineWidth").subscribe(this.refresh, this);

  knockout.getObservable(this, "lineJoin").subscribe(this.refresh, this);

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

  overrideProperty(this, "visualChannels", {
    get() {
      return {
        color: {
          ...baseVisualChannels.color,
          accessor: 'getFillColor',
          condition: config => config.visConfig.filled,
          nullValue: baseVisualChannels.color.nullValue,
          getAttributeValue: config => d => d.properties.fillColor || config.color,
          // used this to get updateTriggers
          defaultValue: config => config.color
        },
        strokeColor: {
          property: 'strokeColor',
          field: 'strokeColorField',
          scale: 'strokeColorScale',
          domain: 'strokeColorDomain',
          range: 'strokeColorRange',
          key: 'strokeColor',
          channelScaleType: CHANNEL_SCALES.color,
          accessor: 'getLineColor',
          condition: config => config.visConfig.stroked,
          nullValue: baseVisualChannels.color.nullValue,
          getAttributeValue: config => d =>
            d.properties.lineColor || config.visConfig.strokeColor || config.color,
          // used this to get updateTriggers
          defaultValue: config => config.visConfig.strokeColor || config.color
        },
        size: {
          ...baseVisualChannels.size,
          property: 'stroke',
          accessor: 'getLineWidth',
          condition: config => config.visConfig.stroked,
          nullValue: 0,
          getAttributeValue: () => d => d.properties.lineWidth || defaultLineWidth
        },
        height: {
          property: 'height',
          field: 'heightField',
          scale: 'heightScale',
          domain: 'heightDomain',
          range: 'heightRange',
          key: 'height',
          channelScaleType: CHANNEL_SCALES.size,
          accessor: 'getElevation',
          condition: config => config.visConfig.enable3d,
          nullValue: 0,
          getAttributeValue: () => d => d.properties.elevation || defaultElevation
        },
        radius: {
          property: 'radius',
          field: 'radiusField',
          scale: 'radiusScale',
          domain: 'radiusDomain',
          range: 'radiusRange',
          key: 'radius',
          channelScaleType: CHANNEL_SCALES.radius,
          accessor: 'getRadius',
          nullValue: 0,
          getAttributeValue: () => d => d.properties.radius || defaultRadius
        }
      };
    }
  })

  overrideProperty(this, "defaultLayerConfig", {
    get() {
      return {
        ...Layer.getDefaultLayerConfig(),

        // add height visual channel
        heightField: null,
        heightDomain: [0, 1],
        heightScale: 'linear',

        // add radius visual channel
        radiusField: null,
        radiusDomain: [0, 1],
        radiusScale: 'linear',

        // add stroke color visual channel
        strokeColorField: null,
        strokeColorDomain: [0, 1],
        strokeColorScale: 'quantile'
      };
    }
  })
};

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
      lineWidth: this.lineWidth,
      lineJoin: this.lineJoin,
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

MapboxVectorTileCatalogItem.prototype.updateLayerMeta = function(allData) {
  const getFeature = this.getPositionAccessor();
  this.dataToFeature = getGeojsonDataMaps(allData, getFeature);

  // get bounds from features
  const bounds = getGeojsonBounds(this.dataToFeature);
  // if any of the feature has properties.radius set to be true
  const fixedRadius = Boolean(
    this.dataToFeature.find(d => d && d.properties && d.properties.radius)
  );

  // keep a record of what type of geometry the collection has
  const featureTypes = getGeojsonFeatureTypes(this.dataToFeature);

  this.updateMeta({bounds, fixedRadius, featureTypes});
}

MapboxVectorTileCatalogItem.prototype.setInitialLayerConfig = function({allData}) {
  this.updateLayerMeta(allData);

  const {featureTypes} = this.meta;
  // default settings is stroke: true, filled: false
  if (featureTypes && featureTypes.polygon) {
    // set both fill and stroke to true
    return this.updateLayerVisConfig({
      filled: true,
      stroked: true,
      strokeColor: colorMaker.next().value
    });
  } else if (featureTypes && featureTypes.point) {
    // set fill to true if detect point
    return this.updateLayerVisConfig({filled: true, stroked: false});
  }

  return this;
}

MapboxVectorTileCatalogItem.prototype.updateLayerVisConfig = function(newVisConfig) {
  this.config.visConfig = {...this.config.visConfig, ...newVisConfig};
  return this;
}

MapboxVectorTileCatalogItem.prototype.updateLayerConfig = function(newConfig) {
  this.config = {...this.config, ...newConfig};
  return this;
}

MapboxVectorTileCatalogItem.prototype.updateLayerColorUI = function(prop, newConfig) {
  const {colorUI: previous, visConfig} = this.config;

  if (!isPlainObject(newConfig) || typeof prop !== 'string') {
    return this;
  }

  const colorUIProp = Object.entries(newConfig).reduce((accu, [key, value]) => {
    return {
      ...accu,
      [key]: isPlainObject(accu[key]) && isPlainObject(value) ? {...accu[key], ...value} : value
    };
  }, previous[prop] || DEFAULT_COLOR_UI);

  const colorUI = {
    ...previous,
    [prop]: colorUIProp
  };

  this.updateLayerConfig({colorUI});
  // if colorUI[prop] is colorRange
  const isColorRange = visConfig[prop] && visConfig[prop].colors;

  if (isColorRange) {
    this.updateColorUIByColorRange(newConfig, prop);
    this.updateColorRangeByColorUI(newConfig, previous, prop);
    this.updateCustomPalette(newConfig, previous, prop);
  }

  return this;
}

/**
   * if open dropdown and prop is color range
   * Automatically set colorRangeConfig's step and reversed
   * @param {*} newConfig
   * @param {*} prop
   */
 MapboxVectorTileCatalogItem.prototype.updateColorUIByColorRange = function(newConfig, prop) {
  if (typeof newConfig.showDropdown !== 'number') return;

  const {colorUI, visConfig} = this.config;
  this.updateLayerConfig({
    colorUI: {
      ...colorUI,
      [prop]: {
        ...colorUI[prop],
        colorRangeConfig: {
          ...colorUI[prop].colorRangeConfig,
          steps: visConfig[prop].colors.length,
          reversed: Boolean(visConfig[prop].reversed)
        }
      }
    }
  });
}

MapboxVectorTileCatalogItem.prototype.updateColorRangeByColorUI = function(newConfig, previous, prop) {
  // only update colorRange if changes in UI is made to 'reversed', 'steps' or steps
  const shouldUpdate =
    newConfig.colorRangeConfig &&
    ['reversed', 'steps'].some(
      key =>
        newConfig.colorRangeConfig.hasOwnProperty(key) &&
        newConfig.colorRangeConfig[key] !==
          (previous[prop] || DEFAULT_COLOR_UI).colorRangeConfig[key]
    );
  if (!shouldUpdate) return;

  const {colorUI, visConfig} = this.config;
  const {steps, reversed} = colorUI[prop].colorRangeConfig;
  const colorRange = visConfig[prop];
  // find based on step or reversed
  let update;
  if (newConfig.colorRangeConfig.hasOwnProperty('steps')) {
    const group = getColorGroupByName(colorRange);

    if (group) {
      const sameGroup = COLOR_RANGES.filter(cr => getColorGroupByName(cr) === group);

      update = sameGroup.find(cr => cr.colors.length === steps);

      if (update && colorRange.reversed) {
        update = reverseColorRange(true, update);
      }
    }
  }

  if (newConfig.colorRangeConfig.hasOwnProperty('reversed')) {
    update = reverseColorRange(reversed, update || colorRange);
  }

  if (update) {
    this.updateLayerVisConfig({[prop]: update});
  }
}

module.exports = MapboxVectorTileCatalogItem;
