const GeowaveVectorTileImageryProvider = require("../Map/GeowaveVectorTileImageryProvider");
const clone = require("terriajs-cesium/Source/Core/clone").default;
const defined = require("terriajs-cesium/Source/Core/defined").default;
const ImageryLayerFeatureInfo = require("terriajs-cesium/Source/Scene/ImageryLayerFeatureInfo").default;
const ImageryLayerCatalogItem = require("./ImageryLayerCatalogItem");
var Resource = require("terriajs-cesium/Source/Core/Resource").default;
const inherit = require("../Core/inherit");
const knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
const Legend = require("../Map/Legend");
const overrideProperty = require("../Core/overrideProperty");
var i18next = require("i18next").default;
var URI = require("urijs");
var xml2json = require("../ThirdParty/xml2json")
var getToken = require("./getToken")
var when = require("terriajs-cesium/Source/ThirdParty/when").default
var Metadata = require("./Metadata");
var loadXML = require("../Core/loadXML")
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl")
var WebMapServiceCatalogItem = require("./WebMapServiceCatalogItem")
var TerriaError = require("../Core/TerriaError");
import _ from 'lodash'
import rgba from 'rgba-convert'
import update from 'immutability-helper'
import Console from 'global/console'
import {
  addToken,
  capabilitiesXmlToJson,
  loadFromCapabilities,
  findLayer,
  populateMetadataGroup,
} from './webMapService'
import {
  DEFAULT_LAYER_OPACITY,
  LAYER_VIS_CONFIGS,
  DEFAULT_COLOR_UI,
} from '../Layers/layer-factory';
import Layer, {baseVisualChannels} from "../Layers/base-layer"
import {
  SCALE_TYPES, CHANNEL_SCALES, FIELD_OPTS
} from "../Constants/default-settings"
import {
  layerVisualChange,
} from '../Actions'

export const DEFAULT_COLOR = '#519AC2'
export const NO_COLOR = 'black'
export const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0)' // 'rgba(0, 255, 0, 0.5)'
export const DEFAULT_LINE_WIDTH = 1
export const DEFAULT_LINE_JOIN = 'round'
export const DEFAULT_RADIUS = 1
export const DEFAULT_DOMAIN = [0, 1]

export const MVT_VISUAL_CONFIGS = {
  opacity: 'opacity',
  strokeOpacity: {
    ...LAYER_VIS_CONFIGS.opacity,
    property: 'strokeOpacity'
  },
  thickness: {
    ...LAYER_VIS_CONFIGS.thickness,
    defaultValue: DEFAULT_LINE_WIDTH,
  },
  color: 'color',
  strokeColor: 'strokeColor',
  colorRange: 'colorRange',
  strokeColorRange: 'strokeColorRange',
  radius: {
    ...LAYER_VIS_CONFIGS.radius,
    defaultValue: DEFAULT_LINE_WIDTH,
    range: [0.5, 50],
  },
  sizeRange: 'strokeWidthRange',
  radiusRange: {
    ...LAYER_VIS_CONFIGS.radiusRange,
    defaultValue: [1.0, 10],
    range: [0.5, 50],
  },
  stroked: 'stroked',
  filled: 'filled',
  enable3d: 'enable3d',
  wireframe: 'wireframe'
};

const LAYER_META_DATA_SCHEMA = {
  name: 'name',
  spatialType: 'spatialType',
  nativeSRS: 'nativeSRS',
  crsWKT: 'layer.spatialInfo.crsWKT',
  envelope: 'layer.spatialInfo.envelope',
}
/**
 * A {@link ImageryLayerCatalogItem} representing a rasterised Mapbox vector tile layer.
 *
 * @alias MapboxVectorTileCatalogItem
 * @constructor
 * @extends ImageryLayerCatalogItem
 *
 * @param {Terria} terria The Terria instance.
 */
const GeowaveVectorTileCatalogItem = function (terria) {
  ImageryLayerCatalogItem.call(this, terria);

  /**
   * Gets or sets the outline color of the features, specified as a CSS color string.
   * @type {String}
   * @default '#519AC2'
   */
  this.lineColor = DEFAULT_COLOR

  /**
   * Gets or sets the fill color of the features, specified as a CSS color string.
   * @type {String}
   * @default 'rgba(0, 0, 0, 0)'
   */
  this.fillColor = TRANSPARENT_COLOR

  /**
   * Gets or sets the outline width of the features, specified in pixels.
   * @type {number}
   * @default 1.0
   */
  this.lineWidth = DEFAULT_LINE_WIDTH

  /**
   * Gets or sets the outline join of the features, in ['bevel' || 'round' || 'miter']
   * @type {String}
   * @default 'round'
   */
  this.lineJoin = DEFAULT_LINE_JOIN

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
   * @default 30
   */
  this.maximumNativeZoom = 20;

  /**
   * Gets or sets the maximum zoom level that can be displayed by using the data in the
   * {@link MapboxVectorTileCatalogItem#maximumNativeZoom} tiles.
   * @type {Number}
   * @default 30
   */
  this.maximumZoom = 20;

  /**
   * Gets or sets the minimum zoom level for which tile files exist.
   * @type {Number}
   * @default 0
   */
  this.minimumZoom = 0;

  // this.layerMetadataUrl = undefined

  this._legendUrl = undefined;

  this._metadata = undefined;

  this._styleFunc = undefined

  this.data = {rows: [], index: new Set()/*FastSet()*/}

  this.accessors = {}

  this.tileCache = {order: [], promise: {}, request: {}}

  this.styleCache = {table: null, accessors: null, computeCss: null}

  this._getCapabilitiesUrl = undefined

  this._config = undefined
  
  this._previewInfo = undefined

  /**
   * Gets or sets the URL to use for requesting tokens. Typically, this is set to `/esri-token-auth` to use
   * the ArcGIS token mechanism built into terriajs-server.
   * @type {String}
   */
  this.tokenUrl = undefined;

  /**
   * Gets or sets the name of the URL query parameter used to provide the token
   * to the server. This property is ignored if {@link WebMapServiceCatalogItem#tokenUrl} is undefined.
   * @type {String}
   * @default 'token'
   */
  this.tokenParameterName = "token";

  /**
   * Gets or sets the additional parameters to pass to the WMS server when requesting images.
   * All parameter names must be entered in lowercase in order to be consistent with references in TerrisJS code.
   * If this property is undefined, {@link WebMapServiceCatalogItem.defaultParameters} is used.
   * @type {Object}
   */
  this.parameters = {};

  knockout.track(this, [
    "_getCapabilitiesUrl",
    "parameters",
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

  // metadataUrl and legendUrl are derived from url if not explicitly specified.
  overrideProperty(this, "metadataUrl", {
    get: function() {
      if (defined(this._metadataUrl)) {
        return this._metadataUrl;
      }

      if (!defined(this.url)) {
        return undefined;
      }

      return (
        cleanUrl(this.url) +
        `/wfs?service=wfs&version=2.0.0&request=DescribeFeatureType&typeName=${this.layer}&outputFormat=application/json`
      );
    },
    set: function(value) {
      this._metadataUrl = value;
    }
  });

  overrideProperty(this, "layerMetadataUrl", {
    get: function() {
      if (defined(this._layerMetadataUrl)) {
        return this._layerMetadataUrl
      }

      return undefined
    },
    set: function(value) {
      this._layerMetadataUrl = value
    }
  })

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

  // getCapabilitiesUrl and legendUrl are derived from url if not explicitly specified.
  overrideProperty(this, "getCapabilitiesUrl", {
    get: function() {
      if (defined(this._getCapabilitiesUrl)) {
        return this._getCapabilitiesUrl;
      }

      // this uses by columns meta
      // if (defined(this.metadataUrl)) {
      //   return this.metadataUrl;
      // }

      if (!defined(this.url)) {
        return undefined;
      }

      return (
        cleanUrl(this.url) +
        "/wms?service=WMS&version=1.3.0&request=GetCapabilities"
      );
    },
    set: function(value) {
      this._getCapabilitiesUrl = value;
    }
  });

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
            valueAccessor(d) { return d[field.name] }
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
        sizeField: null,
        sizeDomain: DEFAULT_DOMAIN,
        sizeScale: SCALE_TYPES.linear,

        // add radius visual channel
        radiusField: null,
        radiusDomain: DEFAULT_DOMAIN,
        radiusScale: SCALE_TYPES.linear,

        // add stroke color visual channel
        strokeColorField: null,
        strokeColorDomain: DEFAULT_DOMAIN,
        strokeColorScale: SCALE_TYPES.quantile,
      })
    },
  })

  overrideProperty(this, 'visual', {
    get: function() {
      return _.cloneDeep(this.initial)
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
          getAttributeValue: d => d.properties.fillColor || this.visual.color,
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
            d.properties.lineColor || this.visual.strokeColor || this.visual.color,
          // used this to get updateTriggers
          defaultValue: () => this.visual.strokeColor || this.visual.color
        },
        size: {
          ...baseVisualChannels.size,
          property: 'stroke',
          accessor: 'getLineWidth',
          condition: visual => visual.stroked,
          nullValue: 0,
          getAttributeValue: d => d.properties.lineWidth || DEFAULT_LINE_WIDTH
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

inherit(ImageryLayerCatalogItem, GeowaveVectorTileCatalogItem);

Object.defineProperties(GeowaveVectorTileCatalogItem.prototype, {
  /**
   * Gets the type of data item represented by this instance.
   * @memberOf MapboxVectorTileCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "gwMvt";
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

  /**
   * Gets the metadata associated with this data source and the server that provided it, if applicable.
   * @memberOf WebMapServiceCatalogItem.prototype
   * @type {Metadata}
   */
   metadata: {
    get: function() {
      if (!defined(this._metadata)) {
        // Console.log('[item.metadata.get] create')
        this._metadata = update(requestMetadata(this), {$unset: ['serviceMetadata']});
      }
      return this._metadata;
    }
  },

  // metadata: {
  //   get: function() {
  //     return this._metadata
  //   },
  //   set: function(val) {
  //     this._metadata = val
  //   }
  // },

  // noneLayerDataAffectingProps: {
  //   get () {
  //     return [];
  //   }
  // }
});

GeowaveVectorTileCatalogItem.abstractsToIgnore = [
  "A compliant implementation of WMS"
];

GeowaveVectorTileCatalogItem.prototype._refresh = function() {
  this.updateLayerDomain()

  // Console.log("gwMvt._refresh")
  // this.tileCache = {order: [], promise: {}, request: {}}
  // this.styleCache = {table: null, accessors: null}

  // 고유키가 없는 아이템의 도메인 데이터 캐쉬를 날리는 시점은 좀 더 고민해봐야 겠다.
  // if (!defined(this.uniqueIdProp)) {
  //   this.data.rows = []
  // }
}

GeowaveVectorTileCatalogItem.prototype.loadColumnsMetadata = function() {
  if (!defined(this.metadataUrl)) {
    return;
  }
  const resource = new Resource({url: this.metadataUrl});
  return resource.fetch().then(response => {
    this._rawColumnMetadata = JSON.parse(response);
    if (this._rawColumnMetadata) {
      this.config.namespace = _.get(this._rawColumnMetadata, 'targetNamespace', undefined)
      this.config.dataId = _.get(this._rawColumnMetadata, 'featureTypes[0].typeName', undefined)
      this.config.fields = _.get(this._rawColumnMetadata, 'featureTypes[0].properties', [])
      this.config.fields = this.config.fields.map(field => {
        if (['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].includes(field.localType)) {
          this.config.geomField = field.name
          this.config.geomType = field.localType
          if (['Point', 'MultiPoint'].includes(field.localType)) {
            const color = rgba(DEFAULT_COLOR)
            this.initial.filled = true
            this.initial.stroked = false
            this.initial.color = color
            this.visual.filled = true
            this.visual.stroked = false
            this.visual.color = color
            this.updateLayerVisual(this, {filled: true, stroked: false, color})
          }
        } else if(['number', 'double precision', 'double', 'float'].includes(field.localType)){
          field.localType ='real'
        }
        return {
          ...field,
          valueAccessor(d) { return d[field.name] }
        }
      })
      // Console.log('[item.loadColumnsMetadata]', {metadata: this._rawColumnMetadata, config: this.config})
    } else {
      throw new TerriaError({
        sender: this,
        title: i18next.t("models.geowave.noUrlTitle"),
        message: i18next.t("models.geowave.noUrlMessage")
      });
    }
  });
}

GeowaveVectorTileCatalogItem.prototype.loadLayerMetadata = function() {
  if (!defined(this.layerMetadataUrl)) {
    return
  }
  const resource = new Resource({url: this.layerMetadataUrl})
  return resource.fetch().then(response => {
    const rawLayerMetadata = JSON.parse(response)
    this._rawLayerMetadata = rawLayerMetadata
    console.log('load later meta data')
    this._previewInfo = Object.keys(LAYER_META_DATA_SCHEMA).reduce((acc, key)=> (
      {
      ...acc,
        [key]: _.get(rawLayerMetadata, LAYER_META_DATA_SCHEMA[key])
      }),{})
    if (this._rawLayerMetadata) {
      return this._rawLayerMetadata
    } else {
      throw new TerriaError({
        sender: this,
        title: i18next.t('models.geowave.noUrlTitle'),
        message: i18next.t('models.geowave.noUrlMessage')
      })
    }
  })
}

GeowaveVectorTileCatalogItem.prototype._remove = function (){
  Console.log('[item._remove]',this)
  // Api 정책으로 인한 all parameter 는 제외한다!
  const url = `${this.parent.url}/api/mapviews/${this.nameInCatalog}`
  Resource.delete(proxyCatalogItemUrl(this, url, '0s')).then(res => {
    //TODO 현재 삭제시 별도 리턴 값은 없음.
  })
}

GeowaveVectorTileCatalogItem.prototype._load = function() {
  Console.log('[item._load]')
  const that = this;

  var promise = when();
  if (this.tokenUrl) {
    promise = getToken(this.terria, this.tokenUrl, this.url);
  }

  return promise.then(function(token) {
    that._lastToken = token;

    const promises = []

    if (!defined(that._rawColumnMetadata)) {
      promises.push(that.loadColumnsMetadata())
    }

    if (!defined(that._rawLayerMetadata)) {
      promises.push(that.loadLayerMetadata())
    }

    if (!defined(that._rawMetadata) && defined(that.getCapabilitiesUrl)) {
      promises.push(
        loadXML(
          proxyCatalogItemUrl(
            that,
            addToken(
              that.getCapabilitiesUrl,
              that.tokenParameterName,
              that._lastToken
            ),
            "1d"
          )
        ).then(function (xml) {
          var metadata = capabilitiesXmlToJson(that, xml);
          that.updateFromCapabilities(metadata, false);
          loadFromCapabilities(that, GeowaveVectorTileCatalogItem.abstractsToIgnore);
        })
      );
    } else {
      loadFromCapabilities(that, GeowaveVectorTileCatalogItem.abstractsToIgnore);
    }

    // Query WMS for wfs or wcs URL if no dataUrl is present
    if (!defined(that.dataUrl) && defined(that.url)) {
      var describeLayersURL =
        cleanUrl(that.url) +
        "?service=WMS&version=1.1.1&sld_version=1.1.0&request=DescribeLayer&layers=" +
        encodeURIComponent(that.layers);

      promises.push(loadXML(proxyCatalogItemUrl(
        that,
        addToken(
          describeLayersURL,
          that.tokenParameterName,
          that._lastToken
        ),
        "1d"
      ))
        .then(function (xml) {
          var json = xml2json(xml);
          // LayerDescription could be an array. If so, only use the first element
          var LayerDescription =
            json.LayerDescription instanceof Array
              ? json.LayerDescription[0]
              : json.LayerDescription;
          if (
            defined(LayerDescription) &&
            defined(LayerDescription.owsURL) &&
            defined(LayerDescription.owsType)
          ) {
            switch (LayerDescription.owsType.toLowerCase()) {
              case "wfs":
                if (
                  defined(LayerDescription.Query) &&
                  defined(LayerDescription.Query.typeName)
                ) {
                  that.dataUrl = addToken(
                    cleanUrl(LayerDescription.owsURL) +
                    "?service=WFS&version=1.1.0&request=GetFeature&typeName=" +
                    LayerDescription.Query.typeName +
                    "&srsName=EPSG%3A4326&maxFeatures=1000",
                    that.tokenParameterName,
                    that._lastToken
                  );
                  that.dataUrlType = "wfs-complete";
                } else {
                  that.dataUrl = addToken(
                    cleanUrl(LayerDescription.owsURL),
                    that.tokenParameterName,
                    that._lastToken
                  );
                  that.dataUrlType = "wfs";
                }
                break;
              case "wcs":
                if (
                  defined(LayerDescription.Query) &&
                  defined(LayerDescription.Query.typeName)
                ) {
                  that.dataUrl = addToken(
                    cleanUrl(LayerDescription.owsURL) +
                    "?service=WCS&version=1.1.1&request=DescribeCoverage&identifiers=" +
                    LayerDescription.Query.typeName,
                    that.tokenParameterName,
                    that._lastToken
                  );

                  if (that.linkedWcsUrl && that.linkedWcsCoverage === "") {
                    that.linkedWcsCoverage = LayerDescription.Query.typeName;
                  }
                  that.dataUrlType = "wcs-complete";
                } else {
                  that.dataUrl = addToken(
                    cleanUrl(LayerDescription.owsURL),
                    that.tokenParameterName,
                    that._lastToken
                  );
                  that.dataUrlType = "wcs";
                }
                break;
            }
          }
        })
        .otherwise(function (err) { })
      ); // Catch potential XML error - doesn't matter if URL can't be retrieved
    }

    return when.all(promises).then(() => {
      that.terria.checkNowViewingForTimeWms();
    });
  })
};

GeowaveVectorTileCatalogItem.prototype._createImageryProvider = function() {
  this.styleCache.accessors = null
  this.styleCache.computeCss = null
  const style = {
    fillStyle: this.fillColor,
    strokeStyle: this.lineColor,
    lineWidth: this.lineWidth,
    lineJoin: this.lineJoin,
  }
  const layerName = this.layer.includes(':') ? this.layer.split(':')[1] : this.layer
  return new GeowaveVectorTileImageryProvider({
    urls: this.urls || [this.url],
    layerName,
    styleFunc: this._styleFunc || (() => style),
    rectangle: this.rectangle,
    minimumZoom: this.minimumZoom,
    maximumNativeZoom: this.maximumNativeZoom,
    maximumZoom: this.maximumZoom,
    uniqueIdProp: this.idProperty,
    fields: this.config.fields,
    featureInfoFunc: feature => featureInfoFromFeature(this, feature),
    // michael: 데이터 도메인이 변경되면 갱신해야 한다.
    data: {...this.data, fields: this.config.fields},
    tileCache: this.tileCache,
    styleCache: this.styleCache,
    updateLayerDomain: this.updateLayerDomain.bind(this),
    refreshFunc: this.refresh,
  });
};

// GeowaveVectorTileCatalogItem.prototype.updateLayerMeta = function(allData) {
//   const getFeature = this.getPositionAccessor();
//   this.dataToFeature = getGeojsonDataMaps(allData, getFeature);

//   // get bounds from features
//   const bounds = getGeojsonBounds(this.dataToFeature);
//   // if any of the feature has properties.radius set to be true
//   const fixedRadius = Boolean(
//     this.dataToFeature.find(d => d && d.properties && d.properties.radius)
//   );

//   // keep a record of what type of geometry the collection has
//   const featureTypes = getGeojsonFeatureTypes(this.dataToFeature);

//   this.updateMeta({bounds, fixedRadius, featureTypes});
// }

// GeowaveVectorTileCatalogItem.prototype.setInitialLayerConfig = function({allData}) {
//   this.updateLayerMeta(allData);

//   const {featureTypes} = this.meta;
//   // default settings is stroke: true, filled: false
//   if (featureTypes && featureTypes.polygon) {
//     // set both fill and stroke to true
//     return this.updateLayerVisual({
//       filled: true,
//       stroked: true,
//       strokeColor: colorMaker.next().value
//     });
//   } else if (featureTypes && featureTypes.point) {
//     // set fill to true if detect point
//     return this.updateLayerVisual({filled: true, stroked: false});
//   }

//   return this;
// }

GeowaveVectorTileCatalogItem.prototype.updateLayerInitial = function(layer, props) {
}

/**
 * 변경된 리덕스 visual 프로퍼티 중에 필요한 것만 카탈로그 아이템에 반영한다.
 * @param layer redux layer
 * @param props properties
 */
GeowaveVectorTileCatalogItem.prototype.updateLayerVisual = function(layer, props) {
  // Console.log('[item.updateLayerVisual]', props)
  // update()를 사용하는 것이 js 디스트럭팅을 쓰는것보다 오류체크가 쉬움

  if (_.has(props, 'opacity')) {
    this.opacity = props.opacity
  }
  if (_.has(props, 'color')) {
    this.fillColor = rgba.css(props.color)
  }
  if (_.has(props, 'colorRange')) {

    this.fillColor = update(this.fillColor, {range: {$set: props.colorRange}})
  }
  if (_.has(props, 'strokeColor')) {
    this.lineColor = rgba.css(props.strokeColor)
  }
  if (_.has(props, 'strokeColorRange')) {
    // js 디스트럭팅을 쓰는것보다 오류체크가 쉬움
    this.lineColor = update(this.lineColor, {range: {$set: props.strokeColorRange}})
  }
  if (_.has(props, 'thickness')) {
    this.lineWidth = props.thickness
  }
  if (_.has(props, 'radius')) {
    this.lineWidth = props.radius
  }
  if (_.has(props, 'radiusRange')) {
    // js 디스트럭팅을 쓰는것보다 오류체크가 쉬움
    this.lineWidth = update(this.lineWidth, {range: {$set: props.radiusRange}})
  }
  if (_.has(props, 'sizeRange')) {
    this.lineWidth = update(this.lineWidth, {range: {$set: props.sizeRange}})
  }
  if (_.has(props, 'filled')) {
    const color = layer.visual.color
    const cssColor = rgba.css(color) === TRANSPARENT_COLOR ? NO_COLOR : rgba.css(color)

    this.fillColor = _.get(props, 'filled') ? (
      layer.visual.colorField ? {
        field: layer.visual.colorField,
        range: layer.visual.colorRange,
        domain: layer.visual.colorDomain,
        scale: layer.visual.colorScale,
        channel: layer.channels.color,
      } : cssColor
    ) : (
      TRANSPARENT_COLOR
    )
  }
  if (_.has(props, 'stroked')) {
    const color = layer.visual.strokeColor
    const cssColor = rgba.css(color) === TRANSPARENT_COLOR ? NO_COLOR : rgba.css(color)

    this.lineColor = _.get(props, 'stroked') ? (
      layer.visual.strokeColorField ? {
        field: layer.visual.strokeColorField,
        range: layer.visual.strokeColorRange,
        domain: layer.visual.strokeColorDomain,
        scale: layer.visual.strokeColorScale,
        channel: layer.channels.strokeColor,
      } : cssColor
    ) : (
      TRANSPARENT_COLOR
    )
  }

  if (this.imageryLayer && this.imageryLayer.imageryProvider) {
    const style = {
      fillStyle: this.fillColor,
      strokeStyle: this.lineColor,
      lineJoin: this.lineJoin,
      lineWidth: this.lineWidth,
    }
    this.imageryLayer.imageryProvider._styleFunc = this._styleFunc = uniqueId => style
  }

  Object.keys(props).forEach(property => {
    this.visual[property] = props[property]
  })

  // 오저버가 안달린 프로퍼티 수정이 있을 경우 아래처럼 처리하려고 했는데 쓸모 없을듯?
  // if (_.some(['colorRange', 'strokeColorRange'], property => _.has(props, property))) {
  //   this.refresh()
  // }
}

GeowaveVectorTileCatalogItem.prototype.updateLayerConfig = function (layer, props) {
}

GeowaveVectorTileCatalogItem.prototype.updateLayerChannel = function (layer, props, channel, scaleKey) {
  Console.log('[item.updateLayerChannel]', {channel, props, scaleKey})
  if (this.shouldCalculateLayerData()) {
    //WIP:
    // const {layerData, layer} = calculateLayerData(layer, state, this.data.rows);
  }

  if (_.has(props, 'colorField')) {
    this.fillColor = props.colorField ? {
      field: props.colorField,
      range: layer.visual.colorRange,
      domain: layer.visual.colorDomain,
      scale: layer.visual.colorScale,
      channel: layer.channels[channel],
    } : rgba.css(layer.visual.color)
  }

  if (_.has(props, 'strokeColorField')) {
    this.lineColor = props.strokeColorField ? {
      field: props.strokeColorField,
      range: layer.visual.strokeColorRange,
      domain: layer.visual.strokeColorDomain,
      scale: layer.visual.strokeColorScale,
      channel: layer.channels[channel],
    } : rgba.css(layer.visual.strokeColor)
  }

  if (_.has(props, 'radiusField')) {
    this.lineWidth = props.radiusField ? {
      field: props.radiusField,
      range: layer.visual.radiusRange,
      domain: layer.visual.radiusDomain,
      scale: layer.visual.radiusScale,
      channel: layer.channels[channel],
    } : layer.visual.radius
  }

  if (_.has(props, 'sizeField')) {
    this.lineWidth = props.sizeField ? {
      field: props.sizeField,
      range: layer.visual.sizeRange,
      domain: layer.visual.sizeDomain,
      scale: layer.visual.sizeScale,
      channel: layer.channels[channel],
    } : layer.visual.thickness
  }

  if (this.imageryLayer.imageryProvider) {
    const style = {
      fillStyle: this.fillColor,
      strokeStyle: this.lineColor,
      lineJoin: this.lineJoin,
      lineWidth: this.lineWidth,
    }
    this.imageryLayer.imageryProvider._styleFunc = this._styleFunc = uniqueId => style
  }

  Object.keys(props).forEach(property => {
    this.visual[property] = props[property]
  })

  this.updateLayerDomain(layer)
  this.refresh()
}

GeowaveVectorTileCatalogItem.prototype.calculateLayerDomain = function (layer, table, channel) {
  const {scale} = channel;
  const scaleType = layer.visual[scale];

  const field = layer.visual[channel.field];
  if (!field) {
    // if colorField or sizeField were set back to null
    return DEFAULT_DOMAIN;
  }

  return table.getColumnLayerDomain(field, scaleType) || DEFAULT_DOMAIN;
}

GeowaveVectorTileCatalogItem.prototype.updateLayerDomain = function (layer) {
  layer = layer || this
  let props = {}
  this.styleCache.table && Object.values(layer.channels).forEach(channel => {
    const {domain} = channel;
    const updatedDomain = this.calculateLayerDomain(layer, this.styleCache.table, channel);
    props = update(props, {[domain]: {$set: updatedDomain}})
    this.visual[domain] = updatedDomain
  })
  // Console.log('[item.updateLayerDomain]', props)
  this.terria.store.dispatch(layerVisualChange(this.uniqueId, props))
  // .then(() => this.updateLayerVisual(layerSelector(this.getState(), this.uniqueId), props))
  // this.updateLayerVisual(layer, props);
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

GeowaveVectorTileCatalogItem.prototype.getScaleOptions = function(channel, field) {
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
 GeowaveVectorTileCatalogItem.prototype.hasAllColumns = function() {
  const {fields} = this.config;
  return (
    (fields &&
    Object.values(fields).every(col => {
      return Boolean(col.nillable);
      // return Boolean(col.optional || (col.value && col.fieldIdx > -1));
    }))
  );
}

/**
 * getPositionAccessor, valueAccessor 등을 재계산해야하는지? 아직 이 기능을 사용하지 않고 있음.
 * @param {Object} [props]
 * @returns
 */
GeowaveVectorTileCatalogItem.prototype.shouldCalculateLayerData = function(props) {
  return false
}

/**
 * Updates this catalog item from a WMS GetCapabilities document.
 * @param {Object|XMLDocument} capabilities The capabilities document.  This may be a JSON object or an XML document.  If it
 *                             is a JSON object, each layer is expected to have a `_parent` property with a reference to its
 *                             parent layer.
 * @param {Boolean} [overwrite=false] True to overwrite existing property values with data from the capabilities; false to
 *                  preserve any existing values.
 * @param {Object} [thisLayer] A reference to this layer within the JSON capabilities object.  If this parameter is not
 *                 specified or if `capabilities` is an XML document, the layer is found automatically based on this
 *                 catalog item's `layers` property.
 * @param {Object} [infoDerivedFromCapabilities] Additional information already derived from the GetCapabilities document, including:
 * @param {Object} [infoDerivedFromCapabilities.availableStyles] The available styles from this WMS server, structured as in the
 *                 {@link WebMapServiceCatalogItem#availableStyles} property.
 * @param {Object} [infoDerivedFromCapabilities.availableDimensions] The available dimensions from this WMS server, structured as in
 *                 the {@link WebMapServiceCatalogItem#availableDimensions} property.
 */
GeowaveVectorTileCatalogItem.prototype.updateFromCapabilities = function (
  capabilities,
  overwrite,
  thisLayer,
  infoDerivedFromCapabilities
) {
  if (defined(capabilities.documentElement)) {
    capabilities = capabilitiesXmlToJson(this, capabilities);
    thisLayer = undefined;
  }

  if (!defined(this.availableStyles)) {
    if (
      defined(infoDerivedFromCapabilities) &&
      defined(infoDerivedFromCapabilities.availableStyles)
    ) {
      this.availableStyles = infoDerivedFromCapabilities.availableStyles;
    } else {
      this.availableStyles = WebMapServiceCatalogItem.getAllAvailableStylesFromCapabilities(
        capabilities
      );
    }
  }

  if (!defined(this.availableDimensions)) {
    if (
      defined(infoDerivedFromCapabilities) &&
      defined(infoDerivedFromCapabilities.availableDimensions)
    ) {
      this.availableDimensions =
        infoDerivedFromCapabilities.availableDimensions;
    } else {
      this.availableDimensions = WebMapServiceCatalogItem.getAllAvailableDimensionsFromCapabilities(
        capabilities
      );
    }
  }

  if (
    !defined(this.isGeoServer) &&
    capabilities &&
    capabilities.Service &&
    capabilities.Service.KeywordList &&
    capabilities.Service.KeywordList.Keyword &&
    capabilities.Service.KeywordList.Keyword.indexOf("GEOSERVER") >= 0
  ) {
    this.isGeoServer = true;
  }

  if (!defined(this.supportsColorScaleRange)) {
    this.supportsColorScaleRange = this.isNcWMS;

    if (!this.supportsColorScaleRange) {
      var hasExtendedRequests =
        capabilities.Capability &&
        capabilities.Capability.ExtendedCapabilities &&
        capabilities.Capability.ExtendedCapabilities.ExtendedRequest;

      if (hasExtendedRequests) {
        var extendedRequests =
          capabilities.Capability.ExtendedCapabilities.ExtendedRequest;
        extendedRequests = Array.isArray(extendedRequests)
          ? extendedRequests
          : [extendedRequests];

        var extendedGetMap = extendedRequests.filter(
          request => request.Request === "GetMap"
        )[0];
        if (extendedGetMap) {
          var urlParameters = Array.isArray(extendedGetMap.UrlParameter)
            ? extendedGetMap.UrlParameter
            : [extendedGetMap.UrlParameter];
          var colorScaleRangeParameter = urlParameters.filter(
            parameter => parameter.ParameterName === "COLORSCALERANGE"
          )[0];
          this.supportsColorScaleRange = defined(colorScaleRangeParameter);
        }
      }
    }
  }

  if (!defined(thisLayer)) {
    thisLayer = findLayer(capabilities.Capability.Layer, this.layer);
    if (!defined(thisLayer)) {
      return;
    }
  }

  this._rawMetadata = capabilities;
  this._thisLayerInRawMetadata = thisLayer;
  this._allLayersInRawMetadata = [thisLayer];
  this._overwriteFromGetCapabilities = overwrite;
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

function cleanUrl(url) {
  // Strip off the search portion of the URL
  var uri = new URI(url);
  uri.path('geoserver')
  uri.search("");
  return uri.toString();
}

function requestMetadata(item) {
  var result = new Metadata();

  result.isLoading = true;

  result.promise = when(item.load())
    .then(function () {
      if (item._rawColumnMetadata) {
        populateMetadataGroup(result.columnMetadata, _.get(item._rawColumnMetadata, 'featureTypes[0].properties', []))
      } else {
        result.columnErrorMessage =
          "Column information not found in DescribeFeatureType operation response.";
      }

      if (item._rawLayerMetadata) {
        populateMetadataGroup(result.layerMetadata, item._rawLayerMetadata)
        populateMetadataGroup(result.viewingLayerMetaData, item._previewInfo)
      } else {
        result.layerErrorMessage =
          'Layer information not found in GeowaveAPI response'
      }

      var json = item._rawMetadata;
      if (json && json.Service) {
        populateMetadataGroup(result.serviceMetadata, json.Service);
      } else {
        result.serviceErrorMessage =
          "Service information not found in GetCapabilities operation response.";
      }

      if (item._thisLayerInRawMetadata) {
        populateMetadataGroup(
          result.dataSourceMetadata,
          item._thisLayerInRawMetadata
        );
      } else {
        result.dataSourceErrorMessage =
          "Layer information not found in GetCapabilities operation response.";
      }

      result.isLoading = false;
    })
    .otherwise(function () {
      result.columnErrorMessage =
        'An error occurred while invoking the DescribeFeatureType service.'
      result.layerErrorMessage =
        'An error occurred while invoking geowave layer service'
      result.dataSourceErrorMessage =
        "An error occurred while invoking the GetCapabilities service.";
      result.serviceErrorMessage =
        "An error occurred while invoking the GetCapabilities service.";
      result.isLoading = false;
    })

  return result;
}

export default GeowaveVectorTileCatalogItem
