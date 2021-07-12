"use strict";
const overrideProperty = require("../Core/overrideProperty");
var Color = require("terriajs-cesium/Source/Core/Color").default;
var ColorMaterialProperty = require("terriajs-cesium/Source/DataSources/ColorMaterialProperty")
  .default;
var defined = require("terriajs-cesium/Source/Core/defined").default;
var knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
var loadBlob = require("../Core/loadBlob");
var loadTwkb = require('../Core/loadTwkb')
var PolylineGraphics = require("terriajs-cesium/Source/DataSources/PolylineGraphics")
  .default;
var when = require("terriajs-cesium/Source/ThirdParty/when").default;
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var zip = require("terriajs-cesium/Source/ThirdParty/zip").default;

var PointGraphics = require("terriajs-cesium/Source/DataSources/PointGraphics")
  .default;
const HeightReference = require("terriajs-cesium/Source/Scene/HeightReference")
  .default;
const CallbackProperty = require('terriajs-cesium/Source/DataSources/CallbackProperty').default
import _ from 'lodash'
import debounce from 'lodash.debounce'
import rgba from 'rgba-convert'
import update from 'immutability-helper'
import Console from 'global/console'
import fast64 from 'fast64'
import {
  default as GeoJsonCatalogItem,
  getJson,
  nameIsDerivedFromUrl,
  reprojectToGeographic,
  getRandomCssColor,
  describeWithoutUnderscores,
  closePolyline,
  createEntitiesFromHoles,
} from "./GeoJsonCatalogItem"
import {
  DEFAULT_LAYER_OPACITY,
  LAYER_VIS_CONFIGS,
  DEFAULT_COLOR_UI,
} from '../Layers/layer-factory'
import {
  getAttributeAccessor
} from '../Layers/base-layer'
import Layer, {baseVisualChannels} from "../Layers/base-layer"
import twkb from 'twkb'
import {
  DEFAULT_COLOR,
  DEFAULT_LINE_WIDTH,
  DEFAULT_LINE_JOIN,
  DEFAULT_ELEVATION,
  DEFAULT_RADIUS,
  DEFAULT_DOMAIN,
  MVT_VISUAL_CONFIGS,
} from './GeowaveVectorTileCatalogItem'
import {
  SCALE_TYPES,
  CHANNEL_SCALES,
  FIELD_OPTS,
} from "../Constants/default-settings"
import {
} from '../Layers/layer-factory';
import {
  layerConfigChange,
  layerVisualChange,
} from '../Actions'
import KeplerTable from "../Utils/table-utils/kepler-table"
import { JSON, Object, parseInt } from 'global'
import HttpStatus from 'http-status-codes'

var standardCssColors = require("../Core/standardCssColors");
var inherit = require("../Core/inherit");
var promiseFunctionToExplicitDeferred = require("../Core/promiseFunctionToExplicitDeferred");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");
var readJson = require("../Core/readJson");
var TerriaError = require("../Core/TerriaError");
var i18next = require("i18next").default;

var updateFromJson = require('../Core/updateFromJson')

const USES_ALTERNATIVE_STROKE = false

/**
 * A {@link CatalogItem} representing Geowave TWKB (derived GeoJSON, WKT) feature data.
 *
 * @alias GeowaveTwkbCatalogItem
 * @constructor
 * @extends CatalogItem
 *
 * @param {Terria} terria The Terria instance.
 * @param {String} [url] The URL from which to retrieve the TWKB data.
 */
var GeowaveTwkbCatalogItem = function(terria, url) {
  GeoJsonCatalogItem.call(this, terria);

  /**
    * Gets or sets the fill color of the features, specified as a CSS color string.
    * @type {String}
    * @default 'rgba(0, 0, 0, 0)'
    */
  this.color = new CallbackProperty(
    (time, result) => fromArray(this.visual.color, this.visual.opacity, result),
    false)
   
  /**
   * Gets or sets the outline color of the features, specified as a CSS color string.
   * @type {String}
   * @default '#519AC2'
   */
  this.strokeColor = new CallbackProperty(
    (time, result) => fromArray(this.visual.strokeColor, this.visual.opacity, result),
    false)

  /**
    * Gets or sets the outline width of the features, specified in pixels.
    * isConstant=false 일 경우 극심한 렌더링 성능 저하가 발생함.
    * @type {number}
    * @default 1.0
    */
  this.thickness = new CallbackProperty((time, result) => this.visual.thickness, true)

  this.size = new CallbackProperty((time, result) => this.visual.size, true)

  this.radius = new CallbackProperty((time, result) => this.visual.radius, true)
 
  /**
    * Gets or sets the outline join of the features, in ['bevel' || 'round' || 'miter']
    * @type {String}
    * @default 'round'
    */
  this.lineJoin = new CallbackProperty((time, result) => DEFAULT_LINE_JOIN, true)

  this.urlAttachment = undefined

  this.optionData = undefined

  this.token = undefined

  this.accessors = {}

  this.tileCache = {order: [], promise: {}, request: {}}

  this.styleCache = {table: null, accessors: {}, computeCss: null}

  this._config = undefined

  knockout.track(this, [
  ]);

  knockout.getObservable(this, "opacity").subscribe(function() {
  }, this);

  overrideProperty(this, "config", {
    get: function() {
      if (this._config) {
        return this._config
      } else if (this._rawColumnMetadata) {
        let geomField
        let geomType
        const fields = _.get(this.metadata.columnMetadata, 'featureTypes[0].properties', []).map(field => {
          if (['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].includes(field.localType)) {
            geomField = field.name
            geomType = field.localType
          }
          return {
            ...field,
            valueAccessor(d) { return d.properties[field.name] }
          }
        })
        this._config = {
          ...Layer.getDefaultLayerConfig(),
          ...(geomField ? {geomField} : {}),
          ...(geomType ? {geomType} : {}),
          fields,
        }
        return this._config
      } else {
        return Layer.getDefaultLayerConfig()
      }
    },
  })

  overrideProperty(this, 'initial', {
    get: function() {
      const INITIAL = {
        opacity: DEFAULT_LAYER_OPACITY,
        strokeOpacity: DEFAULT_LAYER_OPACITY,
        color: rgba(DEFAULT_COLOR),
        strokeColor: rgba(DEFAULT_COLOR),
        thickness: DEFAULT_LINE_WIDTH,
        filled: true,
        stroked: true,
      }
      return Object.keys(MVT_VISUAL_CONFIGS).reduce((ret, item) => {
        if (typeof item === 'string' && LAYER_VIS_CONFIGS[MVT_VISUAL_CONFIGS[item]]) {
          if (defined(INITIAL[item])) {
            ret[item] = INITIAL[item]
          } else {
            // if assigned one of default LAYER_CONFIGS
            ret[item] = LAYER_VIS_CONFIGS[MVT_VISUAL_CONFIGS[item]].defaultValue;
          }
        } else if (['type', 'defaultValue'].every(p => MVT_VISUAL_CONFIGS[item].hasOwnProperty(p))) {
          // if provided customized visConfig, and has type && defaultValue
          // TODO: further check if customized visConfig is valid
          ret[item] = MVT_VISUAL_CONFIGS[item].defaultValue;
        }
        return ret
      }, {
        // TODO: refactor this into separate visual Channel config
        // color by field, domain is set by filters, field, scale type
        colorField: null,
        colorDomain: DEFAULT_DOMAIN,
        colorScale: SCALE_TYPES.quantile,

        // color by size, domain is set by filters, field, scale type
        sizeDomain: DEFAULT_DOMAIN,
        sizeScale: SCALE_TYPES.linear,
        sizeField: null,

        // add height visual channel
        heightField: null,
        heightDomain: DEFAULT_DOMAIN,
        heightScale: 'linear',

        // add radius visual channel
        radiusField: null,
        radiusDomain: DEFAULT_DOMAIN,
        radiusScale: 'linear',

        // add stroke color visual channel
        strokeColorField: null,
        strokeColorDomain: DEFAULT_DOMAIN,
        strokeColorScale: 'quantile'
      })
    },
  })

  overrideProperty(this, 'visual', {
    get: function() {
      return _.cloneDeep(this.initial);
    },
  })

  overrideProperty(this, "setting", {
    get: function() {
      return Object.keys(MVT_VISUAL_CONFIGS).reduce((ret, item) => {
        if (typeof item === 'string' && LAYER_VIS_CONFIGS[MVT_VISUAL_CONFIGS[item]]) {
          if (defined(this.initial[item])) {
            ret[item] = update(LAYER_VIS_CONFIGS[MVT_VISUAL_CONFIGS[item]], {defaultValue: {$set: this.initial[item]}})
          } else {
            // if assigned one of default LAYER_CONFIGS
            ret[item] = LAYER_VIS_CONFIGS[MVT_VISUAL_CONFIGS[item]];
          }
        } else if (['type', 'defaultValue'].every(p => MVT_VISUAL_CONFIGS[item].hasOwnProperty(p))) {
          // if provided customized visual, and has type && defaultValue
          // TODO: further check if customized visual is valid
          ret[item] = MVT_VISUAL_CONFIGS[item];
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
    },
  })

  overrideProperty(this, "channels", {
    get: function() {
      return {
        color: {
          ...baseVisualChannels.color,
          accessor: 'getFillColor',
          condition: visual => visual.filled,
          nullValue: baseVisualChannels.color.nullValue,
          getAttributeValue: d => d.properties.color || this.visual.color,
          // used this to get updateTriggers
          defaultValue: () => this.visual.color
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
          getAttributeValue: d =>
            d.properties.strokeColor || this.visual.strokeColor || this.visual.color,
          // used this to get updateTriggers
          defaultValue: () => this.visual.strokeColor || this.visual.color
        },
        size: {
          ...baseVisualChannels.size,
          property: 'stroke',
          accessor: 'getLineWidth',
          condition: visual => visual.stroked,
          nullValue: 0,
          getAttributeValue: d => d.properties.thickness || DEFAULT_LINE_WIDTH
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
          getAttributeValue: d => d.properties.elevation || DEFAULT_ELEVATION
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
          getAttributeValue: d => d.properties.radius || DEFAULT_RADIUS
        }
      }
    },
  })

};

inherit(GeoJsonCatalogItem, GeowaveTwkbCatalogItem);

Object.defineProperties(GeowaveTwkbCatalogItem.prototype, {
  /**
   * Gets the type of data member represented by this instance.
   * @memberOf GeowaveTwkbCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "gwTwkb";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, 'GeoJSON'.
   * @memberOf GeowaveTwkbCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.gwTwkb.name");
    }
  },
});

GeowaveTwkbCatalogItem.prototype.updateOpacity = function () {
  // nothing to do
}

GeowaveTwkbCatalogItem.prototype._getValuesThatInfluenceLoad = function() {
  return [this.url, this.data];
};

var zipFileRegex = /.zip\b/i;
var geoJsonRegex = /.geojson\b/i;

GeowaveTwkbCatalogItem.prototype.updateFromJson = function(json, options) {
  if (defined(options) && defined(options.isUserSupplied)) {
    this.isUserSupplied = options.isUserSupplied;
  }

  var updatePromise = updateFromJson(this, json, options);

  // Updating from JSON may trigger a load (e.g. if isEnabled is set to true).  So if this catalog item
  // is now loading, wait on the load promise as well, which we can get by calling load.
  return when.all([updatePromise, this.load()]);
}

GeowaveTwkbCatalogItem.prototype._getValuesThatInfluenceLoad = function() {
  // In the future, we can implement auto-reloading when any of these properties change.  Just create a knockout
  // computed property that calls this method and subscribe to change notifications on that computed property.
  // (Will need to use the rateLimit extender, presumably).
  return [this.url, /*Date.now()*/ JSON.stringify(this.optionData)];
};

GeowaveTwkbCatalogItem.prototype._load = function() {
  Console.log('[gwTwkb._load] START')
  var codeSplitDeferred = when.defer();

  var that = this;
  require.ensure(
    "terriajs-cesium/Source/DataSources/GeoJsonDataSource",
    function() {
      var GeoJsonDataSource = require("terriajs-cesium/Source/DataSources/GeoJsonDataSource")
        .default;

      promiseFunctionToExplicitDeferred(codeSplitDeferred, function() {
        // If there is an existing data source, remove it first.
        var reAdd = false;
        if (defined(that._dataSource)) {
          reAdd = that.terria.dataSources.remove(that._dataSource, true);
        }

        that._dataSource = new GeoJsonDataSource(that.name);

        if (reAdd) {
          that.terria.dataSources.add(that._dataSource);
        }

        if (defined(that.data)) {
          return when(that.data, function(data) {
            var promise;
            if (typeof Blob !== "undefined" && data instanceof Blob) {
              promise = readJson(data);
            } else if (data instanceof String || typeof data === "string") {
              try {
                promise = JSON.parse(data);
              } catch (e) {
                throw new TerriaError({
                  sender: that,
                  title: i18next.t("models.gwTwkb.errorLoadingTitle"),
                  message: i18next.t("models.gwTwkb.errorParsingMessage", {
                    appName: that.terria.appName,
                    email:
                      '<a href="mailto:' +
                      that.terria.supportEmail +
                      '">' +
                      that.terria.supportEmail +
                      "</a>."
                  })
                });
              }
            } else {
              promise = data;
            }

            return when(promise, function(json) {
              that.data = json;
              return updateModelFromData(that, json);
            }).otherwise(function() {
              throw new TerriaError({
                sender: that,
                title: i18next.t("models.gwTwkb.errorLoadingTitle"),
                message: i18next.t("models.gwTwkb.errorLoadingMessage", {
                  appName: that.terria.appName,
                  email:
                    '<a href="mailto:' +
                    that.terria.supportEmail +
                    '">' +
                    that.terria.supportEmail +
                    "</a>."
                })
              });
            });
          });
        } else {
          var jsonPromise;
          // zipped data
          if (zipFileRegex.test(that.url)) {
            if (typeof FileReader === "undefined") {
              throw new TerriaError({
                sender: that,
                title: i18next.t("models.gwTwkb.unsupportedBrowserTitle"),
                message: i18next.t("models.gwTwkb.unsupportedBrowserMessage", {
                  appName: that.terria.appName,
                  chrome:
                    '<a href="http://www.google.com/chrome" target="_blank">' +
                    i18next.t("models.gwTwkb.chrome") +
                    "</a>",
                  firefox:
                    '<a href="http://www.mozilla.org/firefox" target="_blank">' +
                    i18next.t("models.gwTwkb.firefox") +
                    "</a>",
                  internetExplorer:
                    '<a href="http://www.microsoft.com/ie" target="_blank">' +
                    i18next.t("models.gwTwkb.internetExplorer") +
                    "</a>"
                })
              });
            }

            jsonPromise = loadBlob(
              proxyCatalogItemUrl(that, that.url, "1d")
            ).then(function(blob) {
              var deferred = when.defer();
              zip.createReader(
                new zip.BlobReader(blob),
                function(reader) {
                  // Look for a file with a .geojson extension.
                  reader.getEntries(function(entries) {
                    var resolved = false;
                    for (var i = 0; i < entries.length; i++) {
                      var entry = entries[i];
                      if (geoJsonRegex.test(entry.filename)) {
                        getJson(entry, deferred);
                        resolved = true;
                      }
                    }

                    if (!resolved) {
                      deferred.reject();
                    }
                  });
                },
                function(e) {
                  deferred.reject(e);
                }
              );
              return deferred.promise;
            });
          } else { // plain data
            Console.log('[item._load]', {url: that.url, urlAttachment: that.urlAttachment})
            jsonPromise = loadTwkb(
              proxyCatalogItemUrl(that, that.url, "1d"),
              that.token,
              that.urlAttachment ? JSON.stringify(that.urlAttachment) : undefined
            );
          }

          return jsonPromise
            .then(function(response) {
              Console.log('[item._load] response OK')

              const json = JSON.parse(response)
              const {geojson, geomType, fields} = createGeoJson(json)

              if (JSON.stringify(fields) !== JSON.stringify(that.config.fields) || geomType !== that.config.geomType) {
                that.styleCache.accessors = {}
                const visual = _.pick(that.initial, ['colorField', 'strokeColorField', 'sizeField', 'colorDomain', 'strokeColorDomain', 'sizeDomain'])
                _.assign(that.visual, visual)
                that.color.setCallback(
                  (time, result) => fromArray(that.visual.color, that.visual.opacity, result),
                  false)
                that.strokeColor.setCallback(
                  (time, result) => fromArray(that.visual.strokeColor, that.visual.opacity, result),
                  false)
                that.terria.store.dispatch(layerConfigChange(that.uniqueId, {geomType, fields}))
                that.terria.store.dispatch(layerVisualChange(that.uniqueId, visual))
              }

              that.config.geomType = geomType
              that.config.fields = fields
              Console.log('[item._load]', geojson)
              return updateModelFromData(that, geojson);

            })
            .otherwise(function(e) {
              if (e instanceof TerriaError) {
                throw e;
              }
              Console.log('[item._load]', e)
              throw new TerriaError({
                sender: that,
                title: i18next.t("models.gwTwkb.couldNotLoadTitle"),
                message: e.message || `HTTP ${e.statusCode} ${HttpStatus.getStatusText(e.statusCode)}`,
              });
            });
        }
      });
    },
    "Cesium-DataSources"
  );

  return codeSplitDeferred.promise;
};

GeowaveTwkbCatalogItem.prototype.refresh = debounce(function() {
  this.terria.currentViewer.notifyRepaintRequired();
}, 1000)

GeowaveTwkbCatalogItem.prototype.updateLayerInitial = function(layer, props) {
}

/**
 * 변경된 리덕스 visual 프로퍼티 중에 필요한 것만 카탈로그 아이템에 반영한다.
 * @param layer redux layer
 * @param props properties
 */
 GeowaveTwkbCatalogItem.prototype.updateLayerVisual = function(layer, props) {
  // Console.log('[item.updateLayerVisual]', props)
  // update()를 사용하는 것이 js 디스트럭팅을 쓰는것보다 오류체크가 쉬움

  Object.keys(props).forEach(property => {
    this.visual[property] = props[property]
  })

  if (_.has(props, 'opacity')) {
    this.opacity = props.opacity
    {
      const [r, g, b] = this.visual.color
      this.visual.color = [r, g, b, 255 * props.opacity]
    }
    {
      const [r, g, b] = this.visual.strokeColor
      this.visual.strokeColor = [r, g, b, 255 * props.opacity]
    }
  }

  // filled, stroked
  const filled_changed = _.has(props, 'filled')
  const stroked_changed = _.has(props, 'stroked')
  if (filled_changed || stroked_changed) {
    this._dataSource.entities.values.forEach(entity => {
      if (USES_ALTERNATIVE_STROKE) {
        if (entity.parent) {
          entity.show = this.visual.stroked && !this.visual.filled
          entity.polyline.show = this.visual.stroked && !this.visual.filled
        } else if (this.visual.stroked && !this.visual.filled) {
          entity.polygon.show = false
          entity.polyline.show = true
        } else if (this.visual.filled) {
          entity.polygon.show = true
          entity.polygon.outline = this.visual.stroked
          entity.polyline.show = false
        } else {
          entity.polygon.show = false
          entity.polyline.show = false
        }
      } else {
        filled_changed && (entity.polygon.fill = this.visual.filled)
        stroked_changed && (entity.polygon.outline = this.visual.stroked)
      }
    })
  }

  // Range
  ['color', 'strokeColor', 'size', 'radius'].filter(
    key => props[`${key}Range`] && layer.visual[`${key}Field`]
  ).forEach(key => {
    this.styleCache.accessors[key] = getAttributeAccessor(
      this.channels[key],
      this.visual[`${key}Field`],
      this.visual[`${key}Scale`],
      this.visual[`${key}Domain`],
      this.visual[`${key}Range`],
      d => d
    )
  })

  // _.get(props, 'filled') ? (
  //   layer.visual.colorField ? {
  //     field: layer.visual.colorField,
  //     range: layer.visual.colorRange,
  //     domain: layer.visual.colorDomain,
  //     scale: layer.visual.colorScale,
  //     channel: layer.channels.color,
  //   } : this.fillColor.setCallback(
  //     () => rgba.css(this.visual.color) === TRANSPARENT_COLOR ? Color.fromCssColorString(NO_COLOR) : fromArray(this.visual.color),
  //     false,
  //   )
  // ) : this.fillColor.setCallback(
  //   () => Color.fromCssColorString(TRANSPARENT_COLOR)
  // )

  // if (_.has(props, 'stroked')) {
  //   // if (_.get(props, 'stroked')) {
  //   //   rgba.css(this.visual.strokeColor) === TRANSPARENT_COLOR && (this.visual.strokeColor = rgba(NO_COLOR))
  //   // } else {
  //   //   this.visual.strokeColor = rgba(TRANSPARENT_COLOR)
  //   // }
  //   const entities = this._dataSource.entities.values;
  //   for (let i = 0; i < entities.length; ++i) {
  //     const entity = entities[i];
  //     if (entity.parent) {
  //       entity.show = this.visual.stroked && !this.visual.filled
  //       entity.polyline.show = this.visual.stroked && !this.visual.filled
  //     } else if (this.visual.stroked && !this.visual.filled) {
  //       entity.polygon.show = false
  //       entity.polyline.show = true
  //     } else if (this.visual.filled) {
  //       entity.polygon.show = true
  //       entity.polyline.show = false
  //     } else {
  //       entity.polygon.show = false
  //       entity.polyline.show = false
  //     }
  //   }
  //   // _.get(props, 'stroked') ? (
  //   //   layer.visual.strokeColorField ? {
  //   //     field: layer.visual.strokeColorField,
  //   //     range: layer.visual.strokeColorRange,
  //   //     domain: layer.visual.strokeColorDomain,
  //   //     scale: layer.visual.strokeColorScale,
  //   //     channel: layer.channels.strokeColor,
  //   //   } : this.lineColor.setCallback(
  //   //     () => rgba.css(this.visual.color) === TRANSPARENT_COLOR ? Color.fromCssColorString(NO_COLOR) : fromArray(this.visual.color),
  //   //     false,
  //   //   )
  //   // ) : new CallbackProperty(
  //   //   TRANSPARENT_COLOR
  //   // )
  // }

  // if (_.has(props, 'colorRange')) {
  //   this.fillColor = update(this.fillColor, {range: {$set: props.colorRange}})
  // }
  // if (_.has(props, 'strokeColorRange')) {
  //   // js 디스트럭팅을 쓰는것보다 오류체크가 쉬움
  //   this.lineColor = update(this.lineColor, {range: {$set: props.strokeColorRange}})
  // }
  // if (_.has(props, 'thickness')) {
  //   this.lineWidth.setCallback(() => this.visual.thickness, false)
  // }
  // if (_.has(props, 'radius')) {
  //   this.lineWidth.setCallback(() => this.visual.radius, false)
  // }
  // if (_.has(props, 'radiusRange')) {
  //   // js 디스트럭팅을 쓰는것보다 오류체크가 쉬움
  //   this.lineWidth = update(this.lineWidth, {range: {$set: props.radiusRange}})
  // }
  // if (_.has(props, 'sizeRange')) {
  //   this.lineWidth = update(this.lineWidth, {range: {$set: props.sizeRange}})
  // }

  // if (this.imageryLayer && this.imageryLayer.imageryProvider) {
  //   const style = {
  //     fillStyle: this.fillColor,
  //     strokeStyle: this.lineColor,
  //     lineJoin: this.lineJoin,
  //     lineWidth: this.lineWidth,
  //   }
  //   this.imageryLayer.imageryProvider._styleFunc = this._styleFunc = uniqueId => style
  // }

  this.refresh()
}

GeowaveTwkbCatalogItem.prototype.updateLayerConfig = function(layer, props) {
  Object.keys(props).forEach(property => {
    this.config[property] = props[property]
  })
}

GeowaveTwkbCatalogItem.prototype.updateLayerChannel = function(layer, props, channel) {
  Console.log('[item.updateLayerChannel]', {channel, props})
  if (this.shouldCalculateLayerData()) {
    //WIP:
    // const {layerData, layer} = calculateLayerData(layer, state, this.data.rows);
  }

  Object.keys(props).forEach(property => {
    this.visual[property] = props[property]
  });

  // channel always change domain
  this.updateLayerDomain(layer);

  // Field
  ['color', 'strokeColor', 'size', 'radius'].forEach(key => {
    if (_.has(props, `${key}Field`)) {
      if (this.visual[`${key}Field`]) {
        Console.log('[item.updateLayerDomain] Field', {key, domain: this.visual[`${key}Domain`]})
        this.styleCache.accessors[key] = getAttributeAccessor(
          this.channels[key],
          this.visual[`${key}Field`],
          this.visual[`${key}Scale`],
          this.visual[`${key}Domain`],
          this.visual[`${key}Range`],
          d => d
        )
        this[key].setCallback(
          (time, result, entity) => fromArray(this.styleCache.accessors[key](entity), this.visual.opacity, result),
          false)
        this.terria.store.dispatch(layerVisualChange(this.uniqueId, {[`${key}Domain`]: this.visual[`${key}Domain`]}))
      } else {
        this[key].setCallback(
          (time, result) => fromArray(this.visual[key], this.visual.opacity, result),
          false)
      }
    }
  });

  // Scale
  ['color', 'strokeColor', 'size', 'radius'].filter(
    key => props[`${key}Scale`] && this.visual[`${key}Field`]
  ).forEach(key => {
    Console.log('[item.updateLayerDomain] Scale', {key, domain: this.visual[`${key}Domain`]})
    this.styleCache.accessors[key] = getAttributeAccessor(
      this.channels[key],
      this.visual[`${key}Field`],
      this.visual[`${key}Scale`],
      this.visual[`${key}Domain`],
      this.visual[`${key}Range`],
      d => d
    )
  })

  this.refresh()
}

GeowaveTwkbCatalogItem.prototype.calculateLayerDomain = function(layer, table, channel) {
  const {scale} = channel;
  const scaleType = layer.visual[scale];
  const field = layer.visual[channel.field];
  if (!field) {
    // if colorField or sizeField were set back to null
    return DEFAULT_DOMAIN;
  }
  return table.getColumnLayerDomain(field, scaleType) || DEFAULT_DOMAIN;
}

GeowaveTwkbCatalogItem.prototype.updateLayerDomain = function(layer) {
  layer = layer || this
  let props = {}
  this.styleCache.table && Object.values(layer.channels).forEach(channel => {
    const {domain} = channel;
    const updatedDomain = this.calculateLayerDomain(layer, this.styleCache.table, channel);
    props = update(props, {[domain]: {$set: updatedDomain}})
    this.visual[domain] = updatedDomain
  })
  this.terria.store.dispatch(layerVisualChange(this.uniqueId, props))
}

// GeowaveVectorTileCatalogItem.prototype.getDefaultDeckLayerProps = function({idx, gpuFilter, mapState}) {
//   return {
//     id: this.layer,
//     idx,
//     coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
//     pickable: true,
//     wrapLongitude: true,
//     parameters: {depthTest: Boolean(mapState.dragRotate || this.visual.enable3d)},
//     hidden: this.config.hidden,
//     // visconfig
//     opacity: this.visual.opacity,
//     highlightColor: this.visual.highlightColor,
//     // data filtering
//     extensions: [dataFilterExtension],
//     filterRange: gpuFilter ? gpuFilter.filterRange : undefined
//   };
// }

GeowaveTwkbCatalogItem.prototype.getScaleOptions = function(channel, field) {
  const {scale, channelScaleType, field: fieldKey} = this.channels[channel];
  field = field || this.visual[fieldKey]
  return field
    ? FIELD_OPTS[field.localType].scale[channelScaleType]
    : [this.initial[scale]];
}

/**
   * When change layer type, try to copy over layer configs as much as possible
   * @param configToCopy - config to copy over
   * @param visConfigSettings - visConfig settings of config to copy
   */
// GeowaveVectorTileCatalogItem.prototype.assignConfigToLayer = function(configToCopy, visConfigSettings) {
//   // don't deep merge visualChannel field
//   // don't deep merge color range, reversed: is not a key by default
//   const shallowCopy = ['colorRange', 'strokeColorRange'].concat(
//     Object.values(this.visualChannels).map(v => v.field)
//   );

//   // don't copy over domain and animation
//   const notToCopy = ['animation'].concat(Object.values(this.visualChannels).map(v => v.domain));
//   // if range is for the same property group copy it, otherwise, not to copy
//   Object.values(this.visualChannels).forEach(v => {
//     if (
//       configToCopy.visConfig[v.range] &&
//       this.visConfigSettings[v.range] &&
//       visConfigSettings[v.range].group !== this.visConfigSettings[v.range].group
//     ) {
//       notToCopy.push(v.range);
//     }
//   });

//   // don't copy over visualChannel range
//   const currentConfig = this.config;
//   const copied = this.copyLayerConfig(currentConfig, configToCopy, {
//     shallowCopy,
//     notToCopy
//   });

//   this.updateLayerConfig(copied);
//   // validate visualChannel field type and scale types
//   Object.keys(this.visualChannels).forEach(channel => {
//     this.validateVisualChannel(channel);
//   });
// }

/**
 * Check whether layer has all columns
 * @returns {boolean} yes or no
 */
GeowaveTwkbCatalogItem.prototype.hasAllColumns = function() {
  const {fields} = this.config;
  return (
    (fields &&
    Object.values(fields).every(col => {
      return true // Boolean(col.nillable);
      // return Boolean(col.optional || (col.value && col.fieldIdx > -1));
    }))
  );
}

/**
 * getPositionAccessor, valueAccessor 등을 재계산해야하는지? 아직 이 기능을 사용하지 않고 있음.
 * @param {Object} [props]
 * @returns 
 */
GeowaveTwkbCatalogItem.prototype.shouldCalculateLayerData = function(props) {
  return false
}

function updateModelFromData(geoJsonItem, geoJson) {
  // If this GeoJSON data is an object literal with a single property, treat that
  // property as the name of the data source, and the property's value as the
  // actual GeoJSON.
  var numProperties = 0;
  var propertyName;
  for (propertyName in geoJson) {
    if (geoJson.hasOwnProperty(propertyName)) {
      ++numProperties;
      if (numProperties > 1) {
        break; // no need to count past 2 properties.
      }
    }
  }

  var name;
  if (numProperties === 1) {
    name = propertyName;
    geoJson = geoJson[propertyName];

    // If we don't already have a name, or our name is just derived from our URL, update the name.
    if (
      !defined(geoJsonItem.name) ||
      geoJsonItem.name.length === 0 ||
      nameIsDerivedFromUrl(geoJsonItem.name, geoJsonItem.url)
    ) {
      geoJsonItem.name = name;
    }
  }

  // Reproject the features if they're not already EPSG:4326.
  var promise = reprojectToGeographic(geoJsonItem, geoJson);

  return when(promise, function() {
    geoJsonItem._readyData = geoJson;

    return loadGeoJson(geoJsonItem);
  });
}

function loadGeoJson(item) {
  /* Style information is applied as follows, in decreasing priority:
    - simple-style properties set directly on individual features in the GeoJSON file
    - simple-style properties set as the 'Style' property on the catalog item
    - our 'options' set below (and point styling applied after Cesium loads the GeoJSON)
    - if anything is under-specified there, then Cesium's defaults come in.

    See https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0
    */

  function defaultColor(colorString, name) {
    if (colorString === undefined) {
      var color = Color.fromCssColorString(
        getRandomCssColor(standardCssColors.highContrast, name)
      );
      color.alpha = 1;
      return color;
    } else {
      return Color.fromCssColorString(colorString);
    }
  }

  function getColor(color) {
    if (typeof color === "string" || color instanceof String) {
      return Color.fromCssColorString(color);
    } else {
      return color;
    }
  }

  function parseMarkerSize(sizeString) {
    var sizes = {
      small: 24,
      medium: 48,
      large: 64
    };

    if (sizeString === undefined) {
      return undefined;
    }

    if (sizes[sizeString]) {
      return sizes[sizeString];
    }
    return parseInt(sizeString, 10); // SimpleStyle doesn't allow 'marker-size: 20', but people will do it.
  }

  var dataSource = item._dataSource;
  var style = defaultValue(item.style, {});
  var options = {
    // describe: describeWithoutUnderscores, // 필드명에서 언더스코어를 숨겨선 안된다.
    markerSize: defaultValue(parseMarkerSize(style["marker-size"]), 20),
    markerSymbol: style["marker-symbol"], // and undefined if none
    markerColor: defaultColor(style["marker-color"], item.name),
    strokeWidth: item.visual.thickness, // number, NOT Cesium.Property
    polygonStroke: item.strokeColor,
    polylineStroke: item.strokeColor,
    markerOpacity: style["marker-opacity"], // not in SimpleStyle spec or supported by Cesium but see below
    clampToGround: item.clampToGround,
    markerUrl: defaultValue(style["marker-url"], null), // not in SimpleStyle spec but gives an alternate to maki marker symbols
    fill: item.color,
  };

  Console.log('[twkb.loadGeoJson]', {options})

  return dataSource.load(item._readyData, options).then(function() {
    var entities = dataSource.entities.values;

    // init data reference table
    item.styleCache.table = new KeplerTable({
      data: entities,
      fields: item.config.fields,
      indexPath: null,
      fieldsPath: null,
      metadata: {}
    })

    item.updateLayerDomain()

    // init value accessors
    item.styleCache.accessors = ['color', 'strokeColor', 'radius', 'size']
    .filter(key => defined(item.visual[`${key}Field`]))
    .reduce((ret, key) => ({
      ...ret,
      [key]: getAttributeAccessor(
        item.channels[key],
        item.visual[`${key}Field`],
        item.visual[`${key}Scale`],
        item.visual[`${key}Domain`], // 실질적인 캐시 대상
        item.visual[`${key}Range`],
        d => d
      )
    }), {})

    for (var i = 0; i < entities.length; ++i) {
      var entity = entities[i];

      var properties = entity.properties || {};
      // If we've got a marker url use that in a billboard
      if (
        (defined(entity.billboard) && defined(options.markerUrl)) ||
        (defined(entity.billboard) && properties["marker-url"])
      ) {
        const url = options.markerUrl
          ? options.markerUrl
          : properties["marker-url"].getValue();
        entity.billboard = {
          image: proxyCatalogItemUrl(item, url),
          width: style["marker-width"],
          height: style["marker-height"],
          rotation: style["marker-angle"],
          color: Color.WHITE
        };

        /* If no marker symbol was provided but Cesium has generated one for a point, then turn it into
         a filled circle instead of the default marker. */
      } else if (
        defined(entity.billboard) &&
        !defined(properties["marker-symbol"]) &&
        !defined(options.markerSymbol)
      ) {
        entity.point = new PointGraphics({
          color: getColor(
            defaultValue(properties["marker-color"], options.markerColor)
          ),
          pixelSize: defaultValue(
            properties["marker-size"],
            options.markerSize / 2
          ),
          outlineWidth: defaultValue(
            properties["stroke-width"],
            options.strokeWidth
          ),
          outlineColor: getColor(
            defaultValue(properties.stroke, options.polygonStroke)
          ),
          heightReference: options.clampToGround
            ? HeightReference.RELATIVE_TO_GROUND
            : null
        });
        if (defined(properties["marker-opacity"])) {
          // not part of SimpleStyle spec, but why not?
          entity.point.color.alpha = parseFloat(properties["marker-opacity"]);
        }
        entity.billboard = undefined;
      }
      if (defined(entity.billboard) && defined(properties["marker-opacity"])) {
        entity.billboard.color = new Color(
          1.0,
          1.0,
          1.0,
          parseFloat(properties["marker-opacity"])
        );
      }

      if (defined(entity.polygon)) {
        entity.polygon.fill = item.visual.filled
        entity.polygon.outline = item.visual.stroked
      }

      // Cesium on Windows can't render polygons with a stroke-width > 1.0.  And even on other platforms it
      // looks bad because WebGL doesn't mitre the lines together nicely.
      // As a workaround for the special case where the polygon is unfilled anyway, change it to a polyline.
      if (USES_ALTERNATIVE_STROKE && defined(entity.polygon)) {
        // GeoJsonDataSource cannot handle outlineWidth as CallbackProperty
        entity.polygon.outlineWidth = item.thickness // overwrite

        if (item.visual.stroked && !item.visual.filled) {
          entity.polyline = new PolylineGraphics();
          entity.polyline.show = entity.polygon.show;
  
          if (defined(entity.polygon.outlineColor)) {
            entity.polyline.material = new ColorMaterialProperty();
            entity.polyline.material.color = item.strokeColor
          }
  
          var hierarchy = entity.polygon.hierarchy.getValue();
  
          var positions = hierarchy.positions;
          closePolyline(positions);
  
          entity.polyline.positions = positions;
          entity.polyline.width = entity.polygon.outlineWidth;
  
          createEntitiesFromHoles(dataSource.entities, hierarchy.holes, entity);
        }

        // Choose primitive
        if (item.visual.stroked && !item.visual.filled) {
          entity.polygon.show = false;
        } else {
          entity.polyline.show = false
        }
      }
    }
  })
}

function fromArray([r, g, b], a, result) {
  if (!defined(result)) {
    result = new Color(r / 255.0, g / 255.0, b / 255.0, a)
  } else {
    result.red = r / 255.0
    result.green = g / 255.0
    result.blue = b / 255.0
    result.alpha = a
  }
  return result
}

function createGeoJson(json) {
  const transformType = {
    tinyint: 'integer',
    smallint: 'integer',
    int: 'integer',
    bigint: 'integer',
    float: 'real',
    double: 'real',
    'double precision': 'real',
    varchar: 'string',
    char: 'string',
  }

  const transformValue = {
    integer: value => parseInt(value, 10),
    real: value => parseFloat(value, 10),
  }

  const fields = json.data.columnsWithSchema
  .filter(field => field.name !== 'shape')
  .map(field =>
    Object.keys(field).reduce((ret, key) => ({
      ...ret,
      [key === 'type' ? 'localType' : key]: transformType[field[key]] || field[key]
    }), {
      // transform: fieldType
      valueAccessor(d) { return d.properties[field.name].getValue() }
    })  
  )

  const fieldsType = fields.reduce((ret, field) => ({
    ...ret,
    [field.name]: field.localType,
  }), {})

  const features = json.data.rows.map(({shape, ...properties}) => {
    const bytes = fast64.decode(shape, {uint8Array: true})
    const collection = twkb.toGeoJSON(bytes)
    const feature = collection.features[0]
    feature.properties = Object.keys(properties).reduce((ret, name) => ({
      ...ret,
      [name]: (transformValue[fieldsType[name]]
        ? transformValue[fieldsType[name]](properties[name])
        : properties[name]
      )
    }), {})
    return feature
  })
  
  const geojson = {
    type: 'FeatureCollection',
    features,
    // srid: '3857',
  }
  
  const geomType = _.get(features, '[0].geometry.type', 'Unknown')

  return {geojson, geomType, fields}
}

export default GeowaveTwkbCatalogItem
// module.exports = GeowaveTwkbCatalogItem;
