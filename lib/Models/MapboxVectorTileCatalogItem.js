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
var URI = require("urijs");
import _ from 'lodash';
import rgba from 'rgba-convert'
import update from 'immutability-helper'

import {
  DEFAULT_LAYER_OPACITY,
  LAYER_VIS_CONFIGS,
  DEFAULT_TEXT_LABEL,
  DEFAULT_COLOR_UI,
  UNKNOWN_COLOR_KEY
} from '../layers/layer-factory';
const {default: Layer, baseVisualChannels} = require("../Layers/base-layer")
import {
  DEFAULT_AGGREGATION, SCALE_TYPES, GEOJSON_FIELDS, HIGHLIGH_COLOR_3D, CHANNEL_SCALES, FIELD_OPTS
} from "../Constants/default-settings"
// import {COLOR_RANGES} from '../Constants/color-ranges';
// import {hexToRgb, getColorGroupByName, reverseColorRange} from '../Utils/color-utils';

export const mvtVisual = {
  opacity: 'opacity',
  strokeOpacity: {
    ...LAYER_VIS_CONFIGS.opacity,
    property: 'strokeOpacity'
  },
  thickness: {
    ...LAYER_VIS_CONFIGS.thickness,
    defaultValue: 0.5
  },
  color: 'color',
  strokeColor: 'strokeColor',
  colorRange: 'colorRange',
  strokeColorRange: 'strokeColorRange',
  radius: 'radius',

  sizeRange: 'strokeWidthRange',
  radiusRange: 'radiusRange',
  heightRange: 'elevationRange',
  elevationScale: 'elevationScale',
  stroked: 'stroked',
  filled: 'filled',
  enable3d: 'enable3d',
  wireframe: 'wireframe'
};

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
  this.fillColor = 'rgba(0, 0, 0, 0)';

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

  this._styleFunc = undefined

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


  // SUBSCRIBES
  // 레이어 피쳐 스타일이 변경되면 이미저리 레이어 캐쉬를 모두 초기화한다.

  knockout.getObservable(this, "fillColor").subscribe(this.refresh, this)

  knockout.getObservable(this, "lineColor").subscribe(this.refresh, this)

  knockout.getObservable(this, "lineWidth").subscribe(this.refresh, this)

  knockout.getObservable(this, "lineJoin").subscribe(this.refresh, this)

  // COMPUTED PROPERTIES

  // /**
  //  * Gets the type of data item represented by this instance.
  //  * @memberOf MapboxVectorTileCatalogItem.prototype
  //  * @type {String}
  //  */
  // overrideProperty(this, 'type', {
  //   get: function() {
  //     return "mvt"; // 'gs-mvt'
  //   },
  //   set: function(val) {
  //     this._type = val
  //   }
  // })
  
  // /**
  //  * Gets a human-readable name for this type of data source, 'Mapbox Vector Tile'.
  //  * @memberOf MapboxVectorTileCatalogItem.prototype
  //  * @type {String}
  //  */
  // overrideProperty(this, 'typeName', {
  //   get: function() {
  //     return i18next.t("models.mapboxVectorTile.name");
  //   },
  //   set: function(val) {
  //     this._typeName = val
  //   }
  // })
  
  // overrideProperty(this, 'metadata', {
  //   get: function() {
  //     return this._metadata
  //   }
  // })

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

  overrideProperty(this, "config", {
    get: function() {
      return {
        ...Layer.getDefaultLayerConfig(),
        fields: this.metadata,
      }
    },
  })

  overrideProperty(this, 'initial', {
    get: function() {
      return {
        opacity: DEFAULT_LAYER_OPACITY,
        strokeOpacity: DEFAULT_LAYER_OPACITY,
        color: rgba('rgba(0, 0, 0, 0)'),
        strokeColor: rgba('#519AC2'),
        thickness: 1.0,
        filled: false,
        stroked: true,
      }
      // return update({} /*mvtVisConfigs*/, {
      //   opacity: {$set: this.opacity},
      //   strokeOpacity: {$set: 1.0},
      //   fillColor: {$set: rgba(this.fillColor)},
      //   strokeColor: {$set: rgba(this.lineColor)},
      //   thickness: {$set: this.lineWidth},
      //   filled: {$set: false},
      //   stroked: {$set: true},
      // })
    },
  })

  overrideProperty(this, 'visual', {
    get: function() {
      return Object.keys(mvtVisual).reduce((ret, item) => {
        if (typeof item === 'string' && LAYER_VIS_CONFIGS[mvtVisual[item]]) {
          if (defined(this.initial[item])) {
            ret[item] = this.initial[item]
          } else {
            // if assigned one of default LAYER_CONFIGS
            ret[item] = LAYER_VIS_CONFIGS[mvtVisual[item]].defaultValue;
          }
        } else if (['type', 'defaultValue'].every(p => mvtVisual[item].hasOwnProperty(p))) {
          // if provided customized visConfig, and has type && defaultValue
          // TODO: further check if customized visConfig is valid
          ret[item] = mvtVisual[item].defaultValue;
        }
        return ret
      }, {
        // TODO: refactor this into separate visual Channel config
        // color by field, domain is set by filters, field, scale type
        colorField: null,
        colorDomain: [0, 1],
        colorScale: SCALE_TYPES.quantile,

        // color by size, domain is set by filters, field, scale type
        sizeDomain: [0, 1],
        sizeScale: SCALE_TYPES.linear,
        sizeField: null,

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
      })

      // return update(mvtVisConfigs, {
      //   opacity: {$set: item.opacity},
      //   strokeOpacity: {$set: 1.0},
      //   fillColor: {$set: rgba(item.fillColor)},
      //   strokeColor: {$set: rgba(item.lineColor)},
      //   thickness: {$set: item.lineWidth},
      //   filled: {$set: false},
      //   stroked: {$set: true},
      //   colorRange: {$set: {
      //     name: 'Ice And Fire',
      //     type: 'diverging',
      //     category: 'Uber',
      //     colors: ['#D50255', '#FEAD54', '#FEEDB1', '#E8FEB5', '#49E3CE', '#0198BD'],
      //     reversed: true,
      //   }},
      //   strokeColorRange: {$set: {
      //     name: 'Ice And Fire',
      //     type: 'diverging',
      //     category: 'Uber',
      //     colors: ['#D50255', '#FEAD54', '#FEEDB1', '#E8FEB5', '#49E3CE', '#0198BD'],
      //     reversed: true
      //   }},
      // })
    },
  })

  overrideProperty(this, "setting", {
    get: function() {
      return Object.keys(mvtVisual).reduce((ret, item) => {
        if (typeof item === 'string' && LAYER_VIS_CONFIGS[mvtVisual[item]]) {
          if (defined(this.initial[item])) {
            ret[item] = update(LAYER_VIS_CONFIGS[mvtVisual[item]], {defaultValue: {$set: this.initial[item]}})
          } else {
            // if assigned one of default LAYER_CONFIGS
            ret[item] = LAYER_VIS_CONFIGS[mvtVisual[item]];
          }
        } else if (['type', 'defaultValue'].every(p => mvtVisual[item].hasOwnProperty(p))) {
          // if provided customized visual, and has type && defaultValue
          // TODO: further check if customized visual is valid
          ret[item] = mvtVisual[item];
        }
        return ret
      }, {
        colorUI: {
          color: DEFAULT_COLOR_UI,
          colorRange: DEFAULT_COLOR_UI,
          strokeColor: DEFAULT_COLOR_UI,
          strokeColorRange: DEFAULT_COLOR_UI,
        },
      }, {})

      // return {
      //   // workbenchItem.supportsOpacity ?
      //   opacity: LAYER_VIS_CONFIGS.opacity,
      //   strokeOpacity: {
      //     ...LAYER_VIS_CONFIGS.opacity,
      //     property: 'strokeOpacity'
      //   },
      //   thickness: LAYER_VIS_CONFIGS.thickness,
      //   filled: LAYER_VIS_CONFIGS.filled,
      //   stroked: LAYER_VIS_CONFIGS.stroked,
      //   colorRange: LAYER_VIS_CONFIGS.colorRange,
      //   strokeColorRange: LAYER_VIS_CONFIGS.colorRange,
      //   sizeRange: LAYER_VIS_CONFIGS.strokeWidthRange,
      //   colorUI: {
      //     color: DEFAULT_COLOR_UI,
      //     colorRange: DEFAULT_COLOR_UI,
      //     fillColor: DEFAULT_COLOR_UI,
      //     strokeColor: DEFAULT_COLOR_UI,
      //     strokeColorRange: DEFAULT_COLOR_UI,
      //   },
      // }
    },
  })

  overrideProperty(this, "channel", {
    get: function() {
      return {
        color: {
          ...baseVisualChannels.color,
          accessor: 'getFillColor',
          condition: visual => visual.filled,
          nullValue: baseVisualChannels.color.nullValue,
          getAttributeValue: visual => d => d.properties.fillColor || visual.color,
          // used this to get updateTriggers
          defaultValue: visual => visual.color
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
          condition: visual => visual.stroked,
          nullValue: baseVisualChannels.color.nullValue,
          getAttributeValue: visual => d =>
            d.properties.lineColor || visual.strokeColor || visual.color,
          // used this to get updateTriggers
          defaultValue: visual => visual.strokeColor || visual.color
        },
        size: {
          ...baseVisualChannels.size,
          property: 'stroke',
          accessor: 'getLineWidth',
          condition: visual => visual.stroked,
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
          condition: visual => visual.enable3d,
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
      }
    },
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
      return "mvt"; // 'gs-mvt'
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
  },

  // noneLayerDataAffectingProps: {
  //   get () {
  //     return [];
  //   }
  // }
});

MapboxVectorTileCatalogItem.prototype._load = function() {
  // console.log("MapboxVectorTileCatalogItem.prototype._load", this.metadataUrl)
  if (!defined(this._metadataUrl)) {
    return;
  }

  const resource = new Resource({url: this._metadataUrl});

  return resource.fetch().then(response => {
    const json = JSON.parse(response);
    if (json) {
      this._metadata = json
      this.config.namespace = _.get(json, 'targetNamespace', undefined)
      this.config.dataId = _.get(json, 'featureTypes[0].typeName', undefined)
      this.config.fields = _.get(json, 'featureTypes[0].properties', {})
      console.log('_load', this._metadata)
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
    styleFunc: this._styleFunc || (() => ({
      fillStyle: this.fillColor,
      strokeStyle: this.lineColor,
      lineWidth: this.lineWidth,
      lineJoin: this.lineJoin,
    })),
    rectangle: this.rectangle,
    minimumZoom: this.minimumZoom,
    maximumNativeZoom: this.maximumNativeZoom,
    maximumZoom: this.maximumZoom,
    uniqueIdProp: this.idProperty,
    featureInfoFunc: feature => featureInfoFromFeature(this, feature)
  });
};

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
    return this.updateLayerVisual({
      filled: true,
      stroked: true,
      strokeColor: colorMaker.next().value
    });
  } else if (featureTypes && featureTypes.point) {
    // set fill to true if detect point
    return this.updateLayerVisual({filled: true, stroked: false});
  }

  return this;
}

MapboxVectorTileCatalogItem.prototype.updateLayerInitial = function(layer, props) {
},

/**
 * 변경된 리덕스 visual 프로퍼티 중에 필요한 것만 카탈로그 아이템에 반영한다.
 * @param layer redux layer
 * @param props properties
 */
MapboxVectorTileCatalogItem.prototype.updateLayerVisual = function(layer, props) {
  console.log('item.updateLayerVisual', props)
  let val = undefined
  let color = undefined
  if (_.has(props, 'opacity')) {
    val = _.get(props, 'opacity')
    this.opacity = val
  }
  if (_.has(props, 'fillColor')) {
    val = _.get(props, 'fillColor')
    this.fillColor = rgba.css(val)
  }
  if (_.has(props, 'strokeColor')) {
    val = _.get(props, 'strokeColor')
    this.lineColor = rgba.css(val)
  }
  if (_.has(props, 'thickness')) {
    val = _.get(props, 'thickness')
    this.lineWidth = val
  }
  if (_.has(props, 'filled')) {
    val = _.get(props, 'filled')
    color = layer.visual.color
    color = rgba.css(color) === 'rgba(0, 0, 0, 0)' ? 'black' : rgba.css(color)
    this.fillColor = val ? color : 'rgba(0, 0, 0, 0)'
  }
  if (_.has(props, 'stroked')) {
    val = _.get(props, 'stroked')
    color = layer.visual.strokeColor
    color = rgba.css(color) === 'rgba(0, 0, 0, 0)' ? 'black' : rgba.css(color)
    this.lineColor = val ? color : 'rgba(0, 0, 0, 0)'
  }
}

// MapboxVectorTileCatalogItem.prototype.updateLayerConfig = function(layer, props) {
// }

MapboxVectorTileCatalogItem.prototype.updateLayerChannel = function(layer, props, channel, scaleKey) {
  let fillStyle = this.fillColor
  let strokeStyle = this.strokeColor
  let lineJoin = this.lineJoin
  let lineWidth = this.lineWidth

  if (_.has(props, 'colorField')) {
    fillStyle = {
      ...props,
      colorRange: layer.visual.colorRange,
      colorDomain: layer.visual.colorDomain,
      colorScale: layer.visual.colorScale,
    }
  }

  if (_.has(props, 'strokeColorField')) {
    // 설정 객체가 아니라 설정 함수로 재구현 중
    // strokeStyle = function(d) {

    // }
    
    strokeStyle = {
      ...props,
      strokeColorRange: layer.visual.strokeColorRange,
      strokeColorDomain: layer.visual.strokeColorDomain,
      strokeColorScale: layer.visual.strokeColorScale,
    }
  }

  const styleFunc = function(d) {
    return {
      fillStyle, strokeStyle, lineJoin, lineWidth,
    }
  }
  this._imageryLayer._imageryProvider._styleFunc = this._styleFunc = styleFunc
  this.refresh()
}

MapboxVectorTileCatalogItem.prototype.getDefaultDeckLayerProps = function({idx, gpuFilter, mapState}) {
  return {
    id: this.layer,
    idx,
    coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    pickable: true,
    wrapLongitude: true,
    parameters: {depthTest: Boolean(mapState.dragRotate || this.config.visConfig.enable3d)},
    hidden: this.config.hidden,
    // visconfig
    opacity: this.config.visConfig.opacity,
    highlightColor: this.config.highlightColor,
    // data filtering
    extensions: [dataFilterExtension],
    filterRange: gpuFilter ? gpuFilter.filterRange : undefined
  };
}

MapboxVectorTileCatalogItem.prototype.getScaleOptions = function(ch) {
  const {field, scale, channelScaleType} = this.channel[ch];
  return this.config[field]
    ? FIELD_OPTS[this.config[field].localType].scale[channelScaleType]
    : [Layer.getDefaultLayerConfig()[scale]];
}

/**
   * When change layer type, try to copy over layer configs as much as possible
   * @param configToCopy - config to copy over
   * @param visConfigSettings - visConfig settings of config to copy
   */
MapboxVectorTileCatalogItem.prototype.assignConfigToLayer = function(configToCopy, visConfigSettings) {
  // don't deep merge visualChannel field
  // don't deep merge color range, reversed: is not a key by default
  const shallowCopy = ['colorRange', 'strokeColorRange'].concat(
    Object.values(this.visualChannels).map(v => v.field)
  );

  // don't copy over domain and animation
  const notToCopy = ['animation'].concat(Object.values(this.visualChannels).map(v => v.domain));
  // if range is for the same property group copy it, otherwise, not to copy
  Object.values(this.visualChannels).forEach(v => {
    if (
      configToCopy.visConfig[v.range] &&
      this.visConfigSettings[v.range] &&
      visConfigSettings[v.range].group !== this.visConfigSettings[v.range].group
    ) {
      notToCopy.push(v.range);
    }
  });

  // don't copy over visualChannel range
  const currentConfig = this.config;
  const copied = this.copyLayerConfig(currentConfig, configToCopy, {
    shallowCopy,
    notToCopy
  });

  this.updateLayerConfig(copied);
  // validate visualChannel field type and scale types
  Object.keys(this.visualChannels).forEach(channel => {
    this.validateVisualChannel(channel);
  });
}

/**
 * Check whether layer has all columns
 * @returns {boolean} yes or no
 */
 MapboxVectorTileCatalogItem.prototype.hasAllColumns = function() {
  const {fields} = this.config;
  return (
    (fields &&
    Object.values(columns).every(col => {
      return Boolean(col.nillable);
      // return Boolean(col.optional || (col.value && col.fieldIdx > -1));
    }))
  );
}

MapboxVectorTileCatalogItem.prototype.shouldCalculateLayerData = function() {
  return false
}

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

function cleanUrl(url) {
  // Strip off the search portion of the URL
  var uri = new URI(url);
  uri.search("");
  return uri.toString();
}

module.exports = MapboxVectorTileCatalogItem;
