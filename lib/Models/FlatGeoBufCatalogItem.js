"use strict";

import _ from 'lodash'
import debounce from 'lodash.debounce'
import Layer, {baseVisualChannels} from "../Layers/base-layer"
import rgba from 'rgba-convert'
import update from 'immutability-helper'
import Console from 'global/console'
import KeplerTable from "../Utils/table-utils/kepler-table"
import HttpStatus from 'http-status-codes'
import {geojson as flatgeobuf} from 'flatgeobuf'
import JSONFormatter from 'json-formatter-js'

import {
  DEFAULT_LAYER_OPACITY,
  LAYER_VIS_CONFIGS,
  DEFAULT_COLOR_UI,
} from '../Layers/layer-factory'
import {
  getAttributeAccessor
} from '../Layers/base-layer'
import {
  DEFAULT_COLOR,
  DEFAULT_LINE_WIDTH,
  DEFAULT_LINE_JOIN,
  DEFAULT_RADIUS,
  DEFAULT_DOMAIN,
} from './GeowaveVectorTileCatalogItem'
import {
  SCALE_TYPES,
  CHANNEL_SCALES,
  FIELD_OPTS,
  ALL_FIELD_TYPES,
} from "../Constants/default-settings"
import {
  layerConfigChange,
  layerVisualChange,
} from '../Actions'

/*global require*/

var Cartesian3 = require("terriajs-cesium/Source/Core/Cartesian3").default;
var Color = require("terriajs-cesium/Source/Core/Color").default;
var ColorMaterialProperty = require("terriajs-cesium/Source/DataSources/ColorMaterialProperty")
  .default;
var defined = require("terriajs-cesium/Source/Core/defined").default;

var DeveloperError = require("terriajs-cesium/Source/Core/DeveloperError")
  .default;
var Entity = require("terriajs-cesium/Source/DataSources/Entity").default;
var knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
var loadBlob = require("../Core/loadBlob");
var loadJson = require("../Core/loadJson");
var PolylineGraphics = require("terriajs-cesium/Source/DataSources/PolylineGraphics")
  .default;
var PropertyBag = require("terriajs-cesium/Source/DataSources/PropertyBag")
  .default;
var JulianDate = require("terriajs-cesium/Source/Core/JulianDate").default;
var when = require("terriajs-cesium/Source/ThirdParty/when").default;
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var zip = require("terriajs-cesium/Source/ThirdParty/zip").default;

var PointGraphics = require("terriajs-cesium/Source/DataSources/PointGraphics")
  .default;
const HeightReference = require("terriajs-cesium/Source/Scene/HeightReference")
  .default;

import { default as GeoJsonCatalogItem } from "./GeoJsonCatalogItem"
var standardCssColors = require("../Core/standardCssColors");
var formatPropertyValue = require("../Core/formatPropertyValue");
var hashFromString = require("../Core/hashFromString");
var inherit = require("../Core/inherit");
var Metadata = require("./Metadata");
var promiseFunctionToExplicitDeferred = require("../Core/promiseFunctionToExplicitDeferred");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");
var readJson = require("../Core/readJson");
var TerriaError = require("../Core/TerriaError");
var Reproject = require("../Map/Reproject");
var i18next = require("i18next").default;

const overrideProperty = require("../Core/overrideProperty");
const CallbackProperty = require('terriajs-cesium/Source/DataSources/CallbackProperty').default

const USES_ALTERNATIVE_STROKE = false
const DEFAULT_EXTRUDED_HEIGHT = 10

export const VISUAL_CONFIGS = {
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
  extrudedHeight: {
    ...LAYER_VIS_CONFIGS.extrudedHeight,
    defaultValue: DEFAULT_EXTRUDED_HEIGHT,
    range: [0, 100],
  },
  sizeRange: 'strokeWidthRange',
  radiusRange: {
    ...LAYER_VIS_CONFIGS.radiusRange,
    defaultValue: [1.0, 10],
    range: [0.5, 50],
  },
  extrudedHeightRange: 'extrudedHeightRange',
  extrudedHeightScale: 'extrudedHeightScale',
  stroked: 'stroked',
  filled: 'filled',
  extruded: 'extruded',
  enable3d: 'enable3d',
  wireframe: 'wireframe'
}

/**
 * A {@link CatalogItem} representing GeoJSON feature data.
 *
 * @alias FlatGeoBufCatalogItem
 * @constructor
 * @extends GeoJsonCatalogItem
 *
 * @param {Terria} terria The Terria instance.
 * @param {String} [url] The URL from which to retrieve the GeoJSON data.
 */
var FlatGeoBufCatalogItem = function(terria, url) {
  GeoJsonCatalogItem.call(this, terria);

  knockout.track(this, [
  ]);

  knockout.getObservable(this, "opacity").subscribe(function() {}, this);

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
        extruded: false,
        radius: DEFAULT_RADIUS,
        extrudedHeight: DEFAULT_EXTRUDED_HEIGHT,
        
        // TODO: refactor this into separate visual Channel config
        // color by field, domain is set by filters, field, scale type
        colorField: null,
        colorDomain: DEFAULT_DOMAIN,
        colorScale: SCALE_TYPES.quantile,

        // color by size, domain is set by filters, field, scale type
        sizeField: null,
        sizeDomain: DEFAULT_DOMAIN,
        sizeScale: SCALE_TYPES.linear,

        // add height visual channel
        extrudedHeightField: null,
        extrudedHeightDomain: DEFAULT_DOMAIN,
        extrudedHeightScale: SCALE_TYPES.linear,

        // add radius visual channel
        radiusField: null,
        radiusDomain: DEFAULT_DOMAIN,
        radiusScale: SCALE_TYPES.linear,

        // add stroke color visual channel
        strokeColorField: null,
        strokeColorDomain: DEFAULT_DOMAIN,
        strokeColorScale: SCALE_TYPES.quantile,
      }
      return Object.keys(VISUAL_CONFIGS).reduce((ret, item) => {
        if (!defined(ret[item]) && LAYER_VIS_CONFIGS[VISUAL_CONFIGS[item]]) {
          // if assigned one of default LAYER_CONFIGS
          ret[item] = LAYER_VIS_CONFIGS[VISUAL_CONFIGS[item]].defaultValue;
        } else if (['type', 'defaultValue'].every(p => VISUAL_CONFIGS[item].hasOwnProperty(p))) {
          // if provided customized visConfig, and has type && defaultValue
          // TODO: further check if customized visConfig is valid
          ret[item] = defaultValue(ret[item], VISUAL_CONFIGS[item].defaultValue);
        }
        return ret
      }, INITIAL)
    },
  })

  overrideProperty(this, 'visual', {
    get: function() {
      return _.cloneDeep(this.initial);
    },
  })

  overrideProperty(this, "setting", {
    get: function() {
      return Object.keys(VISUAL_CONFIGS).reduce((ret, item) => {
        if (LAYER_VIS_CONFIGS[VISUAL_CONFIGS[item]]) {
          if (defined(this.initial[item])) {
            ret[item] = update(LAYER_VIS_CONFIGS[VISUAL_CONFIGS[item]], {defaultValue: {$set: this.initial[item]}})
          } else {
            // if assigned one of default LAYER_CONFIGS
            ret[item] = LAYER_VIS_CONFIGS[VISUAL_CONFIGS[item]];
          }
        } else if (['type', 'defaultValue'].every(p => VISUAL_CONFIGS[item].hasOwnProperty(p))) {
          // if provided customized visual, and has type && defaultValue
          // TODO: further check if customized visual is valid
          ret[item] = VISUAL_CONFIGS[item];
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
        },
        extrudedHeight: {
          property: 'extrudedHeight',
          field: 'extrudedHeightField',
          scale: 'extrudedHeightScale',
          domain: 'extrudedHeightDomain',
          range: 'extrudedHeightRange',
          key: 'extrudedHeight',
          channelScaleType: CHANNEL_SCALES.extrudedHeight,
          accessor: 'getExtrudedHeight',
          condition: visual => visual.extruded,
          nullValue: 0,
          getAttributeValue: d => d.properties.extrudedHeight || DEFAULT_EXTRUDED_HEIGHT,
          supportedFieldTypes: [
            ALL_FIELD_TYPES.real,
            ALL_FIELD_TYPES.integer,
            ALL_FIELD_TYPES.int,
          ],
        },
      }
    },
  })

};

inherit(GeoJsonCatalogItem, FlatGeoBufCatalogItem);

Object.defineProperties(FlatGeoBufCatalogItem.prototype, {
  /**
   * Gets the type of data member represented by this instance.
   * @memberOf GeoJsonCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "FlatGeoBuf";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, 'GeoJSON'.
   * @memberOf GeoJsonCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.FlatGeoBuf.name");
    }
  },

  /**
   * Gets the metadata associated with this data source and the server that provided it, if applicable.
   * @memberOf GeoJsonCatalogItem.prototype
   * @type {Metadata}
   */
  metadata: {
    get: function() {
      // TODO: maybe return the FeatureCollection's properties?
      var result = new Metadata();
      result.isLoading = false;
      result.dataSourceErrorMessage = i18next.t(
        "models.geoJson.dataSourceErrorMessage"
      );
      result.serviceErrorMessage = i18next.t(
        "models.geoJson.serviceErrorMessage"
      );
      return result;
    }
  },
  /**
   * Gets the data source associated with this catalog item.
   * @memberOf FlatGeoBufCatalogItem.prototype
   * @type {DataSource}
   */
  dataSource: {
    get: function() {
      return this._dataSource;
    }
  },

  /**
   * Gets a value indicating whether the opacity of this data source can be changed.
   * @memberOf FlatGeoBufCatalogItem.prototype
   * @type {Boolean}
   */
  supportsOpacity: {
    get: function() {
      return true;
    }
  }
});

FlatGeoBufCatalogItem.prototype._getValuesThatInfluenceLoad = function() {
  return [this.url, this.data];
};

var simpleStyleIdentifiers = [
  "title",
  "description", //
  "marker-size",
  "marker-symbol",
  "marker-color",
  "stroke", //
  "stroke-opacity",
  "stroke-width",
  "fill",
  "fill-opacity"
];

// This next function modelled on Cesium.geoJsonDataSource's defaultDescribe.
export function describeWithoutUnderscores(properties, nameProperty) {
  var html = "";
  if (properties instanceof PropertyBag) {
    // unwrap the properties from the PropertyBag
    properties = properties.getValue(JulianDate.now());
  }
  for (var key in properties) {
    if (properties.hasOwnProperty(key)) {
      if (key === nameProperty || simpleStyleIdentifiers.indexOf(key) !== -1) {
        continue;
      }
      var value = properties[key];
      if (typeof value === "object") {
        value = describeWithoutUnderscores(value);
      } else {
        value = formatPropertyValue(value);
      }
      key = key.replace(/_/g, " ");
      if (defined(value)) {
        html += "<tr><th>" + key + "</th><td>" + value + "</td></tr>";
      }
    }
  }
  if (html.length > 0) {
    html =
      '<table class="cesium-infoBox-defaultTable"><tbody>' +
      html +
      "</tbody></table>";
  }
  return html;
}

FlatGeoBufCatalogItem.prototype._load = function() {
  var codeSplitDeferred = when.defer();

  var that = this;
  require.ensure(
    "terriajs-cesium/Source/DataSources/GeoJsonDataSource",
    function() {
      // 실제로 데이터를 사용할 때만 데이터소스 클래스 로드
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

        // var dataPromise = defined(that.data)
        //   ? Promise.resolve(that.data)
        //   : loadBlob(proxyCatalogItemUrl(that, that.url, "1d"))

        return when(updateModelFromData(that))
        .otherwise(function(e) {
          if (e instanceof TerriaError) {
            throw e;
          }
          Console.log('[item._load]', e)
          throw new TerriaError({
            sender: that,
            title: e.message || i18next.t("models.geoJson.couldNotLoadTitle"),
            message: e.stack || `HTTP ${e.statusCode} ${HttpStatus.getStatusText(e.statusCode)}`,
          });
        });
      });
    },
    "Cesium-DataSources"
  );

  return codeSplitDeferred.promise;
};

export async function updateModelFromData(item) {
  const handleHeaderMeta = (headerMeta) => {
    const formatter = new JSONFormatter(headerMeta, 10)
    const header = formatter.render()
    console.log('[FlatGeoBuf] header', header)
  }

  const bounds = {
    minX: Number.MIN_VALUE,
    minY: Number.MIN_VALUE,
    maxX: Number.MAX_VALUE,
    maxY: Number.MAX_VALUE,
  }

  let count = 0

  for await (const feature of flatgeobuf.deserialize(item.url, bounds, handleHeaderMeta)) {
    // 30000 > crash
    if (count++ >= 100) {
      // async라는 개념때문에 포문을 끝내기 위해 `return`을 사용해야 한다고 착각할 수 있음.
      // `break`를 사용해야 for await 이후의 코드가 실행됨.
      break 
    }

    if (!defined(item.config.geomType) || !defined(item.config.fields)) {
      Console.log('[FlatGeoBuf] deserialize', feature)
      const geomType = feature.geometry.type
      const fields = Object.keys(feature.properties).map(
        field => ({
          name: field,
          type: 'string',
          valueAccessor(d) { return d.properties[field.name].getValue() }
        })
      )

      if (JSON.stringify(fields) !== JSON.stringify(item.config.fields) || geomType !== item.config.geomType) {
        item.styleCache.accessors = {}
        const visual = _.pick(item.initial, [
          'colorField',
          'strokeColorField',
          'sizeField',
          'colorDomain',
          'strokeColorDomain',
          'sizeDomain',
          'extrudedHeightDomain'
        ])
        _.assign(item.visual, visual)
        item.color.definitionChanged.raiseEvent(item.color)
        item.strokeColor.definitionChanged.raiseEvent(item.strokeColor)
        item.terria.store.dispatch(layerConfigChange(item.uniqueId, {geomType, fields}))
        item.terria.store.dispatch(layerVisualChange(item.uniqueId, visual))
      }

      item.config.geomType = geomType
      item.config.fields = fields
    }

    loadFeature(item, feature);
  }

  Console.log('[FGB.updateModelFromData] entities', item._dataSource.entities.values)

  updateEntities(item)
}

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

function loadFeature(item, feature) {
  /* Style information is applied as follows, in decreasing priority:
    - simple-style properties set directly on individual features in the GeoJSON file
    - simple-style properties set as the 'Style' property on the catalog item
    - our 'options' set below (and point styling applied after Cesium loads the GeoJSON)
    - if anything is under-specified there, then Cesium's defaults come in.

    See https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0
    */
  
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
      pointSize: item.radius,
      polylineWidth: item.thickness,
      extrudedHeight: item.extrudedHeight,
    };
  
    Console.log('[FGB.loadFeature]')

    return dataSource.load(feature, options)
}

export function nameIsDerivedFromUrl(name, url) {
  if (name === url) {
    return true;
  }

  if (!url) {
    return false;
  }

  // Is the name just the end of the URL?
  var indexOfNameInUrl = url.lastIndexOf(name);
  if (indexOfNameInUrl >= 0 && indexOfNameInUrl === url.length - name.length) {
    return true;
  }

  return false;
}

/**
 * Get a random color for the data based on the passed string (usually dataset name).
 * @private
 * @param  {String[]} cssColors Array of css colors, eg. ['#AAAAAA', 'red'].
 * @param  {String} name Name to base the random choice on.
 * @return {String} A css color, eg. 'red'.
 */
export function getRandomCssColor(cssColors, name) {
  var index = hashFromString(name || "") % cssColors.length;
  return cssColors[index];
}

function updateEntities(item) {

  Console.log('[FGB.updateEntities] entities', item._dataSource.entities.values)

  function getColor(color) {
    if (typeof color === "string" || color instanceof String) {
      return Color.fromCssColorString(color);
    } else {
      return color;
    }
  }

  var dataSource = item._dataSource;
  var entities = dataSource.entities.values;
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
    pointSize: item.radius,
    polylineWidth: item.thickness,
    extrudedHeight: item.extrudedHeight,
  };

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
  item.styleCache.accessors = ['color', 'strokeColor', 'radius', 'size', 'extrudedHeight']
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
          defaultValue(properties["marker-color"], options.fill)
        ),
        pixelSize: defaultValue(properties["marker-size"], options.pointSize),
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
      entity.point.fill = item.visual.filled
      entity.point.outline = item.visual.stroked
    } else if (defined(entity.polyline)){
      entity.polyline.width = defaultValue(properties["marker-size"], options.polylineWidth)
      entity.polyline.outline = true
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
      entity.polygon.extrudedHeight = options.extrudedHeight
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
}

export function createEntitiesFromHoles(entityCollection, holes, mainEntity) {
  if (!defined(holes)) {
    return;
  }

  for (var i = 0; i < holes.length; ++i) {
    createEntityFromHole(entityCollection, holes[i], mainEntity);
  }
}

function createEntityFromHole(entityCollection, hole, mainEntity) {
  if (
    !defined(hole) ||
    !defined(hole.positions) ||
    hole.positions.length === 0
  ) {
    return;
  }

  var entity = new Entity();

  entity.parent = mainEntity
  entity.name = mainEntity.name;
  entity.availability = mainEntity.availability;
  entity.description = mainEntity.description;
  entity.properties = mainEntity.properties;

  entity.polyline = new PolylineGraphics();
  entity.polyline.show = mainEntity.polyline.show;

  entity.polyline.material = mainEntity.polyline.material;
  // entity.polyline.material = new ColorMaterialProperty();
  // entity.polyline.material.color = mainEntity.polyline.material.color

  entity.polyline.width = mainEntity.polyline.width;

  closePolyline(hole.positions);
  entity.polyline.positions = hole.positions;

  entityCollection.add(entity);

  createEntitiesFromHoles(entityCollection, hole.holes, mainEntity);
}

export function closePolyline(positions) {
  // If the first and last positions are more than a meter apart, duplicate the first position so the polyline is closed.
  if (
    positions.length >= 2 &&
    !Cartesian3.equalsEpsilon(
      positions[0],
      positions[positions.length - 1],
      0.0,
      1.0
    )
  ) {
    positions.push(positions[0]);
  }
}

export function polygonHasWideOutline(polygon) {
  return defined(polygon.outlineWidth) && polygon.outlineWidth.getValue() > 1;
}

export function polygonIsFilled(polygon) {
  var fill = true;
  if (defined(polygon.fill)) {
    fill = polygon.fill.getValue();
  }

  if (!fill) {
    return false;
  }

  if (!defined(polygon.material)) {
    // The default is solid white.
    return true;
  }

  var materialProperties = polygon.material.getValue();
  if (
    defined(materialProperties) &&
    defined(materialProperties.color) &&
    materialProperties.color.alpha === 0.0
  ) {
    return false;
  }

  return true;
}

export function reprojectToGeographic(geoJsonItem, geoJson) {
  var code;

  if (!defined(geoJson.crs)) {
    code = undefined;
  } else if (geoJson.crs.type === "EPSG") {
    code = "EPSG:" + geoJson.crs.properties.code;
  } else if (
    geoJson.crs.type === "name" &&
    defined(geoJson.crs.properties) &&
    defined(geoJson.crs.properties.name)
  ) {
    code = Reproject.crsStringToCode(geoJson.crs.properties.name);
  }

  geoJson.crs = {
    type: "EPSG",
    properties: {
      code: "4326"
    }
  };

  if (!Reproject.willNeedReprojecting(code)) {
    return true;
  }

  return when(
    Reproject.checkProjection(
      geoJsonItem.terria.configParameters.proj4ServiceBaseUrl,
      code
    ),
    function(result) {
      if (result) {
        filterValue(geoJson, "coordinates", function(obj, prop) {
          obj[prop] = filterArray(obj[prop], function(pts) {
            if (pts.length === 0) return [];
            return reprojectPointList(pts, code);
          });
        });
      } else {
        throw new DeveloperError(
          "The crs code for this datasource is unsupported."
        );
      }
    }
  );
}

// Reproject a point list based on the supplied crs code.
function reprojectPointList(pts, code) {
  if (!(pts[0] instanceof Array)) {
    return Reproject.reprojectPoint(pts, code, "EPSG:4326");
  }
  var pts_out = [];
  for (var i = 0; i < pts.length; i++) {
    pts_out.push(Reproject.reprojectPoint(pts[i], code, "EPSG:4326"));
  }
  return pts_out;
}

// Find a member by name in the gml.
function filterValue(obj, prop, func) {
  for (var p in obj) {
    if (obj.hasOwnProperty(p) === false) {
      continue;
    } else if (p === prop) {
      if (func && typeof func === "function") {
        func(obj, prop);
      }
    } else if (typeof obj[p] === "object") {
      filterValue(obj[p], prop, func);
    }
  }
}

// Filter a geojson coordinates array structure.
function filterArray(pts, func) {
  if (!(pts[0] instanceof Array) || !(pts[0][0] instanceof Array)) {
    pts = func(pts);
    return pts;
  }

  var result = new Array(pts.length);
  for (var i = 0; i < pts.length; i++) {
    result[i] = filterArray(pts[i], func); //at array of arrays of points
  }
  return result;
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

FlatGeoBufCatalogItem.prototype.refresh = debounce(function() {
  this.terria.currentViewer.notifyRepaintRequired();
}, 1000)

FlatGeoBufCatalogItem.prototype.updateLayerInitial = function(layer, props) {
}

/**
 * 변경된 리덕스 visual 프로퍼티 중에 필요한 것만 카탈로그 아이템에 반영한다.
 * @param layer redux layer
 * @param props properties
 */
 FlatGeoBufCatalogItem.prototype.updateLayerVisual = function(layer, props) {
  Console.log('[item.updateLayerVisual]', this.visual, props)
  // update()를 사용하는 것이 js 디스트럭팅을 쓰는것보다 오류체크가 쉬움
  Object.keys(props).forEach(property => (this.visual[property] = props[property]))

  if (_.has(props, 'color') || _.has(props, 'filled') || _.has(props, 'opacity')) {
    this.color.definitionChanged.raiseEvent(this.color);
  }
  if (_.has(props, 'strokeColor') || _.has(props, 'stroked') || _.has(props, 'opacity')) {
    this.strokeColor.definitionChanged.raiseEvent(this.strokeColor);
  }
  if (_.has(props, 'thickness') || _.has(props, 'stroked')) {
    this.thickness.definitionChanged.raiseEvent(this.thickness);
  }
  if (_.has(props, 'size')) {
    this.size.definitionChanged.raiseEvent(this.size);
  }
  if (_.has(props, 'radius')) {
    this.radius.definitionChanged.raiseEvent(this.radius);
  }
  if (_.has(props, 'extrudedHeight') || _.has(props, 'extruded')) {
    this.extrudedHeight.definitionChanged.raiseEvent(this.extrudedHeight);
  }

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
  // const c = fromArray(props.color,c)
  // this._dataSource.entities.values.forEach(entity => {
  //     entity.point.color.setValue(c)
  //   }
  // )

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
        const entityType = ['point', 'polygon', 'polyline'].find((key)=>entity[key])
        filled_changed && (entity[entityType].fill = this.visual.filled)
        stroked_changed && (entity[entityType].outline = this.visual.stroked)
      }
    })
  }

  // Range
  ['color', 'strokeColor', 'size', 'radius', 'extrudedHeight'].filter(
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

FlatGeoBufCatalogItem.prototype.updateLayerConfig = function(layer, props) {
  Object.keys(props).forEach(property => {
    this.config[property] = props[property]
  })
}

FlatGeoBufCatalogItem.prototype.updateLayerChannel = function(layer, props, channel) {
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
  ['color', 'strokeColor', 'size', 'radius', 'extrudedHeight'].forEach(key => {
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

        if (['size', 'radius', 'extrudedHeight'].includes(key)){
          this[key === 'size' ? 'thickness' : key].setCallback(
            (time, result, entity) => this.styleCache.accessors[key](entity),
            true)
        } else {
          this[key].setCallback(
            (time, result, entity) => fromArray(this.styleCache.accessors[key](entity), this.visual.opacity, result),
            true)
        }

        this.terria.store.dispatch(layerVisualChange(this.uniqueId, {[`${key}Domain`]: this.visual[`${key}Domain`]}))
      } else {
        this[key].setCallback(
          (time, result) => fromArray(this.visual[key], this.visual.opacity, result),
          true)
      }
    }
  });

  // Scale
  ['color', 'strokeColor', 'size', 'radius', 'extrudedHeight'].filter(
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

FlatGeoBufCatalogItem.prototype.calculateLayerDomain = function(layer, table, channel) {
  const {scale} = channel;
  const scaleType = layer.visual[scale];
  const field = layer.visual[channel.field];
  if (!field) {
    // if colorField or sizeField were set back to null
    return DEFAULT_DOMAIN;
  }
  return table.getColumnLayerDomain(field, scaleType) || DEFAULT_DOMAIN;
}

FlatGeoBufCatalogItem.prototype.updateLayerDomain = function(layer) {
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

FlatGeoBufCatalogItem.prototype.getScaleOptions = function(channel, field) {
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
 FlatGeoBufCatalogItem.prototype.hasAllColumns = function() {
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
 FlatGeoBufCatalogItem.prototype.shouldCalculateLayerData = function(props) {
  return false
}

export default FlatGeoBufCatalogItem
