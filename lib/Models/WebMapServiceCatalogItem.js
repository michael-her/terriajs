"use strict";

/*global require*/
var URI = require("urijs");
var moment = require("moment");
var i18next = require("i18next").default;

var clone = require("terriajs-cesium/Source/Core/clone").default;
var combine = require("terriajs-cesium/Source/Core/combine").default;
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var defined = require("terriajs-cesium/Source/Core/defined").default;

var Ellipsoid = require("terriajs-cesium/Source/Core/Ellipsoid").default;

var GeographicTilingScheme = require("terriajs-cesium/Source/Core/GeographicTilingScheme")
  .default;
var GetFeatureInfoFormat = require("terriajs-cesium/Source/Scene/GetFeatureInfoFormat")
  .default;
var getToken = require("./getToken");
var ImageryProvider = require("terriajs-cesium/Source/Scene/ImageryProvider")
  .default;
var JulianDate = require("terriajs-cesium/Source/Core/JulianDate").default;
var knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
var loadXML = require("../Core/loadXML");
var Rectangle = require("terriajs-cesium/Source/Core/Rectangle").default;
var TimeInterval = require("terriajs-cesium/Source/Core/TimeInterval").default;
var TimeIntervalCollection = require("terriajs-cesium/Source/Core/TimeIntervalCollection")
  .default;
var UrlTemplateImageryProvider = require("terriajs-cesium/Source/Scene/UrlTemplateImageryProvider")
  .default;
var WebMapServiceImageryProvider = require("terriajs-cesium/Source/Scene/WebMapServiceImageryProvider")
  .default;
var WebMercatorTilingScheme = require("terriajs-cesium/Source/Core/WebMercatorTilingScheme")
  .default;
var when = require("terriajs-cesium/Source/ThirdParty/when").default;

var containsAny = require("../Core/containsAny");
var Metadata = require("./Metadata");
var MetadataItem = require("./MetadataItem");
var TerriaError = require("../Core/TerriaError");
var ImageryLayerCatalogItem = require("./ImageryLayerCatalogItem");
var inherit = require("../Core/inherit");
var runLater = require("../Core/runLater");
var overrideProperty = require("../Core/overrideProperty");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");
var unionRectangleArray = require("../Map/unionRectangleArray");
var xml2json = require("../ThirdParty/xml2json");
var LegendUrl = require("../Map/LegendUrl");
var callWebCoverageService = require("./callWebCoverageService");

import {
  addToken,
  capabilitiesXmlToJson,
  loadFromCapabilities,
  findLayer,
  findLayers,
  requestMetadata,
} from './webMapService'

/**
 * A {@link ImageryLayerCatalogItem} representing a layer from a Web Map Service (WMS) server.
 *
 * @alias WebMapServiceCatalogItem
 * @constructor
 * @extends ImageryLayerCatalogItem
 *
 * @param {Terria} terria The Terria instance.
 */
var WebMapServiceCatalogItem = function(terria) {
  ImageryLayerCatalogItem.call(this, terria);

  this._rawMetadata = undefined;
  this._thisLayerInRawMetadata = undefined;
  this._allLayersInRawMetadata = undefined;

  this._metadata = undefined;
  this._getCapabilitiesUrl = undefined;

  this._rectangle = undefined;
  this._rectangleFromMetadata = undefined;
  this._intervalsFromMetadata = undefined;

  this._lastToken = undefined;
  this._newTokenRequestInFlight = undefined;

  /**
   * Gets or sets the WMS layers to include.  To specify multiple layers, separate them
   * with a commas.  This property is observable.
   * @type {String}
   */
  this.layers = "";

  /**
   * Gets or sets the URL of a WCS that enables clip-and-ship for this WMS item. This
   * proerty is part of an experimental feature and may be subject to change.
   * @type {String}
   */
  this.linkedWcsUrl = undefined;

  /**
   * Gets or sets the coverage name for linked WCS for clip-and-ship. This proerty is part
   * of an experimental feature and may be subject to change.
   * @type {String}
   */
  this.linkedWcsCoverage = "";

  /**
   * Gets or sets the comma-separated list of styles to request, one per layer list in {@link WebMapServiceCatalogItem#layers}.
   * This property is observable.
   * @type {String}
   */
  this.styles = "";

  /**
   * Gets or sets the additional parameters to pass to the WMS server when requesting images.
   * All parameter names must be entered in lowercase in order to be consistent with references in TerrisJS code.
   * If this property is undefined, {@link WebMapServiceCatalogItem.defaultParameters} is used.
   * @type {Object}
   */
  this.parameters = {};

  /**
   * Gets or sets the tiling scheme to pass to the WMS server when requesting images.
   * If this property is undefiend, the default tiling scheme of the provider is used.
   * @type {Object}
   */
  this.tilingScheme = undefined;

  /**
   * Gets or sets the formats in which to try WMS GetFeatureInfo requests.  If this property is undefined, the `WebMapServiceImageryProvider` defaults
   * are used.  This property is observable.
   * @type {GetFeatureInfoFormat[]}
   */
  this.getFeatureInfoFormats = undefined;

  /**
   * Gets or sets a value indicating whether a time dimension, if it exists in GetCapabilities, should be used to populate
   * the {@link ImageryLayerCatalogItem#intervals}.  If the {@link ImageryLayerCatalogItem#intervals} property is set explicitly
   * on this catalog item, the value of this property is ignored.
   * @type {Boolean}
   * @default true
   */
  this.populateIntervalsFromTimeDimension = true;

  /**
   * Gets or sets the denominator of the largest scale (smallest denominator) for which tiles should be requested.  For example, if this value is 1000, then tiles representing
   * a scale larger than 1:1000 (i.e. numerically smaller denominator, when zooming in closer) will not be requested.  Instead, tiles of the largest-available scale, as specified by this property,
   * will be used and will simply get blurier as the user zooms in closer.
   * @type {Number}
   */
  this.minScaleDenominator = undefined;

  /**
   * Gets or sets a value indicating whether to continue showing tiles or hide tiles when the {@link WebMapServiceCatalogItem#minScaleDenominator}
   * is exceeded. This property is observable.
   * @type {Boolean}
   * @default true
   */
  this.hideLayerAfterMinScaleDenominator = false;

  /**
   * Gets or sets the maximum number of intervals that can be created by a single
   * date range, when specified in the form time/time/periodicity.
   * eg. 2015-04-27T16:15:00/2015-04-27T18:45:00/PT15M has 11 intervals
   * @type {Number}
   */
  this.maxRefreshIntervals = 1000;

  /**
   * Gets or sets whether this WMS has been identified as being provided by a GeoServer.
   * @type {Boolean}
   */
  this.isGeoServer = undefined;

  /**
   * Gets or sets whether this WMS has been identified as being provided by an Esri ArcGIS MapServer. No assumption is made about where an ArcGIS MapServer endpoint also exists.
   * @type {Boolean}
   */
  this.isEsri = undefined;

  /**
   * Gets or sets whether this WMS has been identified as being provided by ncWMS.
   * @type {Boolean}
   */
  this.isNcWMS = undefined;

  /**
   * Gets or sets whether this WMS server has been identified as supporting the COLORSCALERANGE parameter.
   * @type {Boolean}
   */
  this.supportsColorScaleRange = undefined;

  /**
   * Gets or sets how many seconds time-series data with a start date but no end date should last, in seconds.
   * @type {Number}
   */
  this.displayDuration = undefined;

  /**
   * Gets or sets a value indicating whether the user's ability to change the display properties of this
   * catalog item is disabled.  For example, if true, {@link WebMapServiceCatalogItem#styles} should not be
   * changeable through the user interface.
   * This property is observable.
   * @type {Boolean}
   * @default false
   */
  this.disableUserChanges = false;

  /**
   * Gets or sets the available styles for each selected layer in {@link WebMapServiceCatalogItem#layers}.  If undefined,
   * this property is automatically populated from the WMS GetCapabilities on load.  This property is an object that has a
   * property named for each layer.  The value of the property is an array where each element in the array is a style supported
   * by the layer.  The style has `name`, `title`, `abstract`, and `legendUrl` properties.
   * This property is observable.
   * @type {Object}
   * @example
   * wmsItem.availableStyles = {
   *     'FVCOM-NECOFS-GOM3/x': [
   *         {
   *              name: 'default-scalar/default',
   *              title: 'default-scalar/default',
   *              abstract: 'default-scalar style, using the default palette.',
   *              legendUrl: new LegendUrl('http://www.smast.umassd.edu:8080/ncWMS2/wms?REQUEST=GetLegendGraphic&PALETTE=default&COLORBARONLY=true&WIDTH=110&HEIGHT=264', 'image/png')
   *         }
   *     ]
   * };
   */
  this.availableStyles = undefined;

  /**
   * Gets or sets the minumum of the color scale range.  Because COLORSCALERANGE is a non-standard
   * property supported by ncWMS servers, this property is ignored unless {@link WebMapServiceCatalogItem#supportsColorScaleRange}
   * is true.  {@link WebMapServiceCatalogItem#colorScaleMaximum} must be set as well.
   * @type {Number}
   */
  this.colorScaleMinimum = undefined;

  /**
   * Gets or sets the maximum of the color scale range.  Because COLORSCALERANGE is a non-standard
   * property supported by ncWMS servers, this property is ignored unless {@link WebMapServiceCatalogItem#supportsColorScaleRange}
   * is true.  {@link WebMapServiceCatalogItem#colorScaleMinimum} must be set as well.
   * @type {Number}
   */
  this.colorScaleMaximum = undefined;

  /**
   * Gets or sets the list of additional dimensions (e.g. elevation) and their possible values available from the
   * WMS server.  If undefined, this property is automatically populated from the WMS GetCapabilities on load.
   * This property is an object that has a property named for each layer.  The value of the property is an array
   * of dimensions available for this layer.  A dimension has the fields shown in the example below.  See the
   * WMS 1.3.0 specification, section C.2, for a description of the fields.  All fields are optional except
   * `name` and `options`.  This property is observable.
   * @type {Object}
   * @example
   * wmsItem.availableDimensions = {
   *     mylayer: [
   *         {
   *             name: 'elevation',
   *             units: 'CRS:88',
   *             unitSymbol: 'm',
   *             default: -0.03125,
   *             multipleValues: false,
   *             nearestValue: false,
   *             options: [
   *                 -0.96875,
   *                 -0.90625,
   *                 -0.84375,
   *                 -0.78125,
   *                 -0.71875,
   *                 -0.65625,
   *                 -0.59375,
   *                 -0.53125,
   *                 -0.46875,
   *                 -0.40625,
   *                 -0.34375,
   *                 -0.28125,
   *                 -0.21875,
   *                 -0.15625,
   *                 -0.09375,
   *                 -0.03125
   *             ]
   *         }
   *     ]
   * };
   */
  this.availableDimensions = undefined;

  /**
   * Gets or sets the selected values for dimensions available for this WMS layer.  The value of this property is
   * an object where each key is the name of a dimension and each value is the value to use for that dimension.
   * Note that WMS does not allow dimensions to be explicitly specified per layer.  So the selected dimension values are
   * applied to all layers with a corresponding dimension.
   * This property is observable.
   * @type {Object}
   * @example
   * wmsItem.dimensions = {
   *     elevation: -0.65625
   * };
   */
  this.dimensions = undefined;

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
   * Gets or sets the set of HTTP status codes that indicate that a token is invalid.
   * This property is ignored if {@link WebMapServiceCatalogItem#tokenUrl} is undefined.
   * @type {Number[]}
   * @default [401, 498, 499]
   */
  this.tokenInvalidHttpCodes = [401, 498, 499];

  /**
   * A HTML string to show above the chart as a disclaimer
   * @type {String}
   * @default null
   */
  this.chartDisclaimer = null;

  this._sourceInfoItemNames = ["GetCapabilities URL"];

  knockout.track(this, [
    "_getCapabilitiesUrl",
    "_rectangle",
    "_rectangleFromMetadata",
    "_intervalsFromMetadata",
    "layers",
    "styles",
    "parameters",
    "getFeatureInfoFormats",
    "tilingScheme",
    "populateIntervalsFromTimeDimension",
    "minScaleDenominator",
    "disableUserChanges",
    "availableStyles",
    "colorScaleMinimum",
    "colorScaleMaximum",
    "availableDimensions",
    "dimensions",
    "tokenUrl",
    "tokenParameterName",
    "tokenInvalidHttpCodes",
    "_lastToken",
    "_thisLayerInRawMetadata",
    "_allLayersInRawMetadata"
  ]);

  knockout.defineProperty(this, "_colorScaleRange", {
    get: function() {
      return [this.colorScaleMinimum, this.colorScaleMaximum];
    }
  });

  this._refreshInProgress = undefined;
  knockout.getObservable(this, "_colorScaleRange").subscribe(function() {
    if (this.isEnabled && !this._refreshInProgress) {
      this._refreshInProgress = runLater(() => {
        this.refresh();
        this._refreshInProgress = undefined;
      });
    }
  }, this);

  // getCapabilitiesUrl and legendUrl are derived from url if not explicitly specified.
  overrideProperty(this, "getCapabilitiesUrl", {
    get: function() {
      if (defined(this._getCapabilitiesUrl)) {
        return this._getCapabilitiesUrl;
      }

      if (defined(this.metadataUrl)) {
        return this.metadataUrl;
      }

      if (!defined(this.url)) {
        return undefined;
      }

      return (
        cleanUrl(this.url) +
        "?service=WMS&version=1.3.0&request=GetCapabilities"
      );
    },
    set: function(value) {
      this._getCapabilitiesUrl = value;
    }
  });

  var legendUrlsBase = Object.getOwnPropertyDescriptor(this, "legendUrls");

  overrideProperty(this, "legendUrls", {
    get: function() {
      if (defined(this._legendUrls)) {
        return this._legendUrls;
      } else if (defined(this._legendUrl)) {
        return [this._legendUrl];
      } else {
        return computeLegendUrls(this);
      }
    },
    set: function(value) {
      legendUrlsBase.set.call(this, value);
    }
  });

  // The dataUrl must be explicitly specified.  Don't try to use `url` as the the dataUrl, because it won't work for a WMS URL.
  overrideProperty(this, "dataUrl", {
    get: function() {
      return this._dataUrl;
    },
    set: function(value) {
      this._dataUrl = value;
    }
  });

  overrideProperty(this, "dataUrlType", {
    get: function() {
      return this._dataUrlType;
    },
    set: function(value) {
      this._dataUrlType = value;
    }
  });
};

inherit(ImageryLayerCatalogItem, WebMapServiceCatalogItem);

Object.defineProperties(WebMapServiceCatalogItem.prototype, {
  /**
   * Gets the type of data item represented by this instance.
   * @memberOf WebMapServiceCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "wms";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, 'Web Map Service (WMS)'.
   * @memberOf WebMapServiceCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.webMapServiceCatalogItem.wms");
    }
  },

  /**
   * Gets a value indicating whether this {@link ImageryLayerCatalogItem} supports the {@link ImageryLayerCatalogItem#intervals}
   * property for configuring time-dynamic imagery.
   * @type {Boolean}
   */
  supportsIntervals: {
    get: function() {
      return true;
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
        this._metadata = requestMetadata(this);
      }
      return this._metadata;
    }
  },

  /**
   * Gets the set of functions used to update individual properties in {@link CatalogMember#updateFromJson}.
   * When a property name in the returned object literal matches the name of a property on this instance, the value
   * will be called as a function and passed a reference to this instance, a reference to the source JSON object
   * literal, and the name of the property.
   * @memberOf WebMapServiceCatalogItem.prototype
   * @type {Object}
   */
  updaters: {
    get: function() {
      return WebMapServiceCatalogItem.defaultUpdaters;
    }
  },

  /**
   * Gets the set of functions used to serialize individual properties in {@link CatalogMember#serializeToJson}.
   * When a property name on the model matches the name of a property in the serializers object literal,
   * the value will be called as a function and passed a reference to the model, a reference to the destination
   * JSON object literal, and the name of the property.
   * @memberOf WebMapServiceCatalogItem.prototype
   * @type {Object}
   */
  serializers: {
    get: function() {
      return WebMapServiceCatalogItem.defaultSerializers;
    }
  },

  /**
   * Gets the set of names of the properties to be serialized for this object when {@link CatalogMember#serializeToJson} is called
   * for a share link.
   * @memberOf WebMapServiceCatalogItem.prototype
   * @type {String[]}
   */
  propertiesForSharing: {
    get: function() {
      return WebMapServiceCatalogItem.defaultPropertiesForSharing;
    }
  },

  /**
   * Gets the title of each of the layers in {@link WebMapServiceCatalogItem#layers}.  If the layer
   * titles are not yet known (because GetCapabilities has not been loaded yet, for example), this
   * property will return undefined.
   * @memberOf ImageryLayerCatalogItem.prototype
   * @type {String[]}
   */
  layerTitles: {
    get: function() {
      if (!defined(this._allLayersInRawMetadata)) {
        return undefined;
      }
      return this._allLayersInRawMetadata.map(function(layer) {
        return layer.Title || layer.Name;
      });
    }
  }
});

WebMapServiceCatalogItem.defaultUpdaters = clone(
  ImageryLayerCatalogItem.defaultUpdaters
);

WebMapServiceCatalogItem.defaultUpdaters.tilingScheme = function(
  wmsItem,
  json,
  propertyName,
  options
) {
  if (json.tilingScheme === "geographic") {
    wmsItem.tilingScheme = new GeographicTilingScheme();
  } else if (json.tilingScheme === "web-mercator") {
    wmsItem.tilingScheme = new WebMercatorTilingScheme();
  } else {
    wmsItem.tilingScheme = json.tilingScheme;
  }
};

WebMapServiceCatalogItem.defaultUpdaters.getFeatureInfoFormats = function(
  wmsItem,
  json,
  propertyName,
  options
) {
  var formats = [];

  for (var i = 0; i < json.getFeatureInfoFormats.length; ++i) {
    var format = json.getFeatureInfoFormats[i];
    formats.push(new GetFeatureInfoFormat(format.type, format.format));
  }

  wmsItem.getFeatureInfoFormats = formats;
};

Object.freeze(WebMapServiceCatalogItem.defaultUpdaters);

WebMapServiceCatalogItem.defaultSerializers = clone(
  ImageryLayerCatalogItem.defaultSerializers
);

// Serialize the underlying properties instead of the public views of them.
WebMapServiceCatalogItem.defaultSerializers.getCapabilitiesUrl = function(
  wmsItem,
  json,
  propertyName
) {
  json.getCapabilitiesUrl = wmsItem._getCapabilitiesUrl;
};

WebMapServiceCatalogItem.defaultSerializers.tilingScheme = function(
  wmsItem,
  json,
  propertyName
) {
  if (wmsItem.tilingScheme instanceof GeographicTilingScheme) {
    json.tilingScheme = "geographic";
  } else if (wmsItem.tilingScheme instanceof WebMercatorTilingScheme) {
    json.tilingScheme = "web-mercator";
  } else {
    json.tilingScheme = wmsItem.tilingScheme;
  }
};

// Do not serialize availableDimensions, availableStyles, intervals, description, info - these can be huge and can be recovered from the server.
// Normally when you share a WMS item, it is inside a WMS group, and when CatalogGroups are shared, they share their contents applying the
// CatalogMember.propertyFilters.sharedOnly filter, which only shares the "propertiesForSharing".
// However, if you create a straight WMS item outside a group (eg. by duplicating it), then share it, it will serialize everything it can.
WebMapServiceCatalogItem.defaultSerializers.availableDimensions = function() {};
WebMapServiceCatalogItem.defaultSerializers.availableStyles = function() {};
WebMapServiceCatalogItem.defaultSerializers.intervals = function() {};
WebMapServiceCatalogItem.defaultSerializers.description = function() {};
WebMapServiceCatalogItem.defaultSerializers.info = function() {};

Object.freeze(WebMapServiceCatalogItem.defaultSerializers);

/**
 * Gets or sets the default set of properties that are serialized when serializing a {@link CatalogItem}-derived object
 * for a share link.
 * @type {String[]}
 */
WebMapServiceCatalogItem.defaultPropertiesForSharing = clone(
  ImageryLayerCatalogItem.defaultPropertiesForSharing
);
WebMapServiceCatalogItem.defaultPropertiesForSharing.push("styles");
WebMapServiceCatalogItem.defaultPropertiesForSharing.push("colorScaleMinimum");
WebMapServiceCatalogItem.defaultPropertiesForSharing.push("colorScaleMaximum");
WebMapServiceCatalogItem.defaultPropertiesForSharing.push("dimensions");

Object.freeze(WebMapServiceCatalogItem.defaultPropertiesForSharing);

/**
 * The collection of strings that indicate an Abstract property should be ignored.  If these strings occur anywhere
 * in the Abstract, the Abstract will not be used.  This makes it easy to filter out placeholder data like
 * Geoserver's "A compliant implementation of WMS..." stock abstract.
 * @type {Array}
 */
WebMapServiceCatalogItem.abstractsToIgnore = [
  "A compliant implementation of WMS"
];

WebMapServiceCatalogItem.getAllAvailableStylesFromCapabilities = function(
  capabilities,
  layers,
  result,
  inheritedStyles
) {
  if (!defined(result)) {
    result = {};
    layers =
      capabilities && capabilities.Capability
        ? capabilities.Capability.Layer
        : [];
  }

  if (!defined(layers)) {
    return result;
  }

  layers = Array.isArray(layers) ? layers : [layers];

  for (var i = 0; i < layers.length; ++i) {
    var layer = layers[i];
    var styles = WebMapServiceCatalogItem.getSingleLayerStylesFromCapabilities(
      layer,
      inheritedStyles
    );
    if (defined(layer.Name) && layer.Name.length > 0) {
      result[layer.Name] = styles;
    }
    WebMapServiceCatalogItem.getAllAvailableStylesFromCapabilities(
      capabilities,
      layer.Layer,
      result,
      styles
    );
  }

  return result;
};

WebMapServiceCatalogItem.getSingleLayerStylesFromCapabilities = function(
  layerInCapabilities,
  inheritedStyles
) {
  inheritedStyles = inheritedStyles || [];

  if (!defined(layerInCapabilities) || !defined(layerInCapabilities.Style)) {
    return inheritedStyles;
  }

  var styles = Array.isArray(layerInCapabilities.Style)
    ? layerInCapabilities.Style
    : [layerInCapabilities.Style];
  return inheritedStyles.concat(
    styles.map(function(style) {
      var legendUrl = Array.isArray(style.LegendURL)
        ? style.LegendURL[0]
        : style.LegendURL;

      var legendUri, legendMimeType;
      if (
        legendUrl &&
        legendUrl.OnlineResource &&
        legendUrl.OnlineResource["xlink:href"]
      ) {
        legendUri = new URI(
          decodeURIComponent(legendUrl.OnlineResource["xlink:href"])
        );
        legendMimeType = legendUrl.Format;
      }

      return {
        name: style.Name,
        title: style.Title,
        abstract: style.Abstract,
        legendUri: legendUri
          ? new LegendUrl(legendUri.toString(), legendMimeType)
          : undefined
      };
    })
  );
};

WebMapServiceCatalogItem.getAllAvailableDimensionsFromCapabilities = function(
  capabilities,
  layers,
  result,
  inheritedDimensions
) {
  if (!defined(result)) {
    result = {};
    layers =
      capabilities && capabilities.Capability
        ? capabilities.Capability.Layer
        : [];
  }

  if (!defined(layers)) {
    return result;
  }

  layers = Array.isArray(layers) ? layers : [layers];

  for (var i = 0; i < layers.length; ++i) {
    var layer = layers[i];
    var dimensions = WebMapServiceCatalogItem.getSingleLayerDimensionsFromCapabilities(
      layer,
      inheritedDimensions
    );
    if (defined(layer.Name) && layer.Name.length > 0) {
      result[layer.Name] = dimensions;
    }
    WebMapServiceCatalogItem.getAllAvailableDimensionsFromCapabilities(
      capabilities,
      layer.Layer,
      result,
      dimensions
    );
  }

  return result;
};

WebMapServiceCatalogItem.getSingleLayerDimensionsFromCapabilities = function(
  layerInCapabilities,
  inheritedDimensions
) {
  inheritedDimensions = inheritedDimensions || [];

  if (
    !defined(layerInCapabilities) ||
    !defined(layerInCapabilities.Dimension)
  ) {
    return inheritedDimensions;
  }

  var dimensions = Array.isArray(layerInCapabilities.Dimension)
    ? layerInCapabilities.Dimension
    : [layerInCapabilities.Dimension];

  // WMS 1.1.1 puts dimension values in an Extent element instead of directly in the Dimension element.
  var extents = layerInCapabilities.Extent
    ? Array.isArray(layerInCapabilities.Extent)
      ? layerInCapabilities.Extent
      : [layerInCapabilities.Extent]
    : [];

  // Filter out inherited dimensions that are duplicated here.  Child layer dimensions override parent layer dimensions.
  inheritedDimensions = inheritedDimensions.filter(
    inheritedDimension =>
      dimensions.filter(dimension => dimension.name === inheritedDimension.name)
        .length === 0
  );

  return inheritedDimensions.concat(
    dimensions.map(dimension => {
      var correspondingExtent = extents.filter(
        extent => extent.name === dimension.name
      )[0];

      var options;
      if (correspondingExtent && correspondingExtent.split) {
        options = correspondingExtent.split(",");
      } else if (dimension.split) {
        options = dimension.split(",");
      } else {
        options = [];
      }

      return {
        name: dimension.name,
        units: dimension.units,
        unitSymbol: dimension.unitSymbol,
        default: dimension.default,
        multipleValues: dimension.multipleValues,
        nearestValue: dimension.nearestValue,
        options: options
      };
    })
  );
};

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
WebMapServiceCatalogItem.prototype.updateFromCapabilities = function(
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

  if (
    (!defined(this.isEsri) && defined(capabilities["xmlns:esri_wms"])) ||
    this.url.match(/\/MapServer\//)
  ) {
    this.isEsri = true;
  }

  if (
    !defined(this.isNcWMS) &&
    capabilities &&
    capabilities.Capability &&
    capabilities.Capability.Layer
  ) {
    var myLayer = findLayers(capabilities.Capability.Layer, this.layers);
    if (defined(myLayer) && myLayer.length > 0) {
      myLayer = myLayer[0];
      if (myLayer && myLayer.Style && myLayer.Style.length > 0) {
        for (var j = 0; j < myLayer.Style.length; ++j) {
          if (
            !defined(this.isNcWMS) &&
            myLayer.Style[j].Name &&
            (myLayer.Style[j].Name.match(/boxfill\/rainbow/i) ||
              myLayer.Style[j].Name.match(/default-scalar\/default/i) ||
              myLayer.Style[j].Name.match(/default-vector\/default/i))
          ) {
            this.isNcWMS = true;
          }
        }
      }
    }
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
    thisLayer = findLayers(capabilities.Capability.Layer, this.layers);

    if (defined(this.layers)) {
      var layers = this.layers.split(",");
      var styles = (this.styles || this.parameters.styles || "").split(",");
      for (var i = 0; i < thisLayer.length; ++i) {
        if (!defined(thisLayer[i])) {
          if (thisLayer.length > 1) {
            console.log(
              'A layer with the name or ID "' +
                layers[i] +
                '" does not exist on the WMS Server - ignoring it.'
            );
            thisLayer.splice(i, 1);
            layers.splice(i, 1);
            styles.splice(i, 1);
            --i;
          } else {
            var suggested =
              capabilities &&
              capabilities.Capability &&
              capabilities.Capability.Layer &&
              capabilities.Capability.Layer.Layer &&
              capabilities.Capability.Layer.Layer.Name;
            suggested = suggested
              ? ' (Perhaps it should be "' + suggested + '").'
              : "";
            throw new TerriaError({
              title: i18next.t(
                "models.webMapServiceCatalogItem.noLayerFoundTitle"
              ),
              message: i18next.t(
                "models.webMapServiceCatalogItem.noLayerFoundMessage",
                {
                  name: this.name,
                  layers: this.layers,
                  suggested: suggested,
                  email:
                    '<a href="mailto:' +
                    this.terria.supportEmail +
                    '">' +
                    this.terria.supportEmail +
                    "</a>.",
                  line: "\n"
                }
              )
            });
          }
        } else {
          layers[i] = thisLayer[i].Name;
        }
      }

      this.layers = layers.join(",");
      this.styles = styles.join(",");
    }

    if (thisLayer.length === 0) {
      return;
    }
  }

  this._rawMetadata = capabilities;

  if (Array.isArray(thisLayer)) {
    this._thisLayerInRawMetadata = thisLayer[0];
    this._allLayersInRawMetadata = thisLayer;
    thisLayer = this._thisLayerInRawMetadata;
  } else {
    this._thisLayerInRawMetadata = thisLayer;
    this._allLayersInRawMetadata = [thisLayer];
  }

  this._overwriteFromGetCapabilities = overwrite;
};

WebMapServiceCatalogItem.prototype._load = function() {
  var that = this;

  var promise = when();
  if (this.tokenUrl) {
    promise = getToken(this.terria, this.tokenUrl, this.url);
  }

  return promise.then(function(token) {
    that._lastToken = token;

    var promises = [];

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
          loadFromCapabilities(that, WebMapServiceCatalogItem.abstractsToIgnore);
        })
      );
    } else {
      loadFromCapabilities(that, WebMapServiceCatalogItem.abstractsToIgnore);
    }

    // Query WMS for wfs or wcs URL if no dataUrl is present
    if (!defined(that.dataUrl) && defined(that.url)) {
      var describeLayersURL =
        cleanUrl(that.url) +
        "?service=WMS&version=1.1.1&sld_version=1.1.0&request=DescribeLayer&layers=" +
        encodeURIComponent(that.layers);

      promises.push(
        loadXML(
          proxyCatalogItemUrl(
            that,
            addToken(
              describeLayersURL,
              that.tokenParameterName,
              that._lastToken
            ),
            "1d"
          )
        )
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
  });
};

function fixPlaceholders(urlString) {
  return urlString.replace(/%7B/g, "{").replace(/%7D/g, "}");
}

WebMapServiceCatalogItem.prototype.handleTileError = function(
  detailsRequestPromise,
  imageryProvider,
  x,
  y,
  level
) {
  if (!defined(this.tokenUrl)) {
    return detailsRequestPromise;
  }

  const that = this;
  return detailsRequestPromise.otherwise(function(e) {
    if (e && (e.statusCode === 498 || e.statusCode === 499)) {
      // This looks like an invalid token error, so try requesting a new one.
      if (!defined(that._newTokenRequestInFlight)) {
        that._newTokenRequestInFlight = getToken(
          that.terria,
          that.tokenUrl,
          that.url
        ).then(function(token) {
          that._lastToken = token;

          // Turns out setting a parameter after the WMS provider is created is not a thing we can do elegantly.
          // So here we do it super hackily.
          const oldTemplateProvider = imageryProvider._tileProvider;
          const newTemplateProvider = new UrlTemplateImageryProvider({
            url: fixPlaceholders(
              addToken(
                oldTemplateProvider.url,
                that.tokenParameterName,
                that._lastToken
              )
            ),
            pickFeaturesUrl: fixPlaceholders(
              addToken(
                oldTemplateProvider.pickFeaturesUrl,
                that.tokenParameterName,
                that._lastToken
              )
            ),
            tilingScheme: oldTemplateProvider.tilingScheme,
            rectangle: oldTemplateProvider.rectangle,
            tileWidth: oldTemplateProvider.tileWidth,
            tileHeight: oldTemplateProvider.tileHeight,
            minimumLevel: oldTemplateProvider.minimumLevel,
            maximumLevel: oldTemplateProvider.maximumLevel,
            proxy: oldTemplateProvider.proxy,
            subdomains: oldTemplateProvider.subdomains,
            tileDiscardPolicy: oldTemplateProvider.tileDiscardPolicy,
            credit: oldTemplateProvider.credit,
            getFeatureInfoFormats: oldTemplateProvider.getFeatureInfoFormats,
            enablePickFeatures: oldTemplateProvider.enablePickFeatures,
            hasAlphaChannel: oldTemplateProvider.hasAlphaChannel,
            urlSchemeZeroPadding: oldTemplateProvider.urlSchemeZeroPadding
          });
          newTemplateProvider._errorEvent = oldTemplateProvider._errorEvent;

          imageryProvider._tileProvider = newTemplateProvider;

          that._newTokenRequestInFlight = undefined;
        });
      }

      return that._newTokenRequestInFlight;
    } else {
      return when.reject(e);
    }
  });
};

WebMapServiceCatalogItem.prototype._createImageryProvider = function(time) {
  var parameters = objectToLowercase(this.parameters);

  if (defined(time)) {
    parameters = combine({ time: time }, parameters);
  }

  if (defined(this._lastToken)) {
    parameters = combine({ [this.tokenParameterName]: this._lastToken });
  }

  parameters = combine(parameters, WebMapServiceCatalogItem.defaultParameters);
  // request one more feature than we will show, so that we can tell the user if there are more not shown
  if (defined(parameters.feature_count)) {
    console.log(
      this.name +
        ": using parameters.feature_count (" +
        parameters.feature_count +
        ") to override maximumShownFeatureInfos (" +
        this.maximumShownFeatureInfos +
        ")."
    );
    if (parameters.feature_count === 1) {
      this.maximumShownFeatureInfos = 1;
    } else {
      this.maximumShownFeatureInfos = parameters.feature_count - 1;
    }
  } else {
    parameters.feature_count = this.maximumShownFeatureInfos + 1;
  }

  if (
    defined(this.styles) &&
    (!defined(parameters.styles) || parameters.styles.length === 0)
  ) {
    parameters.styles = this.styles;
  }

  if (
    defined(this.colorScaleMinimum) &&
    defined(this.colorScaleMaximum) &&
    !defined(parameters.colorscalerange)
  ) {
    parameters.colorscalerange = [
      this.colorScaleMinimum,
      this.colorScaleMaximum
    ].join(",");
  }

  var maximumLevel = scaleDenominatorToLevel(this.minScaleDenominator);

  if (
    defined(this.dimensions) &&
    (!defined(parameters.dimensions) || parameters.dimensions.length === 0)
  ) {
    for (var dimensionName in this.dimensions) {
      if (this.dimensions.hasOwnProperty(dimensionName)) {
        // elevation is specified as simply elevation.
        // Other (custom) dimensions are prefixed with 'dim_'.
        // See WMS 1.3.0 spec section C.3.2 and C.3.3.
        if (dimensionName.toLowerCase() === "elevation") {
          parameters.elevation = this.dimensions[dimensionName];
        } else {
          parameters["dim_" + dimensionName] = this.dimensions[dimensionName];
        }
      }
    }
  }

  const imageryOptions = {
    url: cleanAndProxyUrl(this, this.url),
    layers: this.layers,
    getFeatureInfoFormats: this.getFeatureInfoFormats,
    parameters: parameters,
    getFeatureInfoParameters: parameters,
    tilingScheme: defined(this.tilingScheme)
      ? this.tilingScheme
      : new WebMercatorTilingScheme(),
    maximumLevel: maximumLevel
  };

  if (this.hideLayerAfterMinScaleDenominator) {
    imageryOptions.maximumLevel = maximumLevel + 1;
  }

  var imageryProvider = new WebMapServiceImageryProvider(imageryOptions);

  if (this.hideLayerAfterMinScaleDenominator) {
    var realRequestImage = imageryProvider.requestImage;
    var messageDisplayed = false;

    var that = this;
    imageryProvider.requestImage = function(x, y, level) {
      if (level > maximumLevel) {
        if (!messageDisplayed) {
          that.terria.error.raiseEvent(
            new TerriaError({
              title: i18next.t(
                "models.webMapServiceCatalogItem.datasetScaleErrorTitle"
              ),
              message: i18next.t(
                "models.webMapServiceCatalogItem.datasetScaleErrorMessage",
                { name: that.name }
              )
            })
          );
          messageDisplayed = true;
        }
        return ImageryProvider.loadImage(
          imageryProvider,
          that.terria.baseUrl + "images/blank.png"
        );
      }
      return realRequestImage.call(imageryProvider, x, y, level);
    };
  }

  return imageryProvider;
};

WebMapServiceCatalogItem.prototype.exportData = function() {
  // Use linked WCS to export data
  if (!defined(this.linkedWcsUrl)) {
    return undefined;
  }
  callWebCoverageService(this);
};

WebMapServiceCatalogItem.defaultParameters = {
  transparent: true,
  format: "image/png",
  exceptions: "application/vnd.ogc.se_xml",
  styles: "",
  tiled: true
};

function cleanAndProxyUrl(catalogItem, url) {
  return proxyCatalogItemUrl(catalogItem, cleanUrl(url));
}

function cleanUrl(url) {
  // Strip off the search portion of the URL
  var uri = new URI(url);
  uri.search("");
  return uri.toString();
}

function scaleDenominatorToLevel(minScaleDenominator) {
  if (!defined(minScaleDenominator) || minScaleDenominator <= 0.0) {
    return undefined;
  }

  var metersPerPixel = 0.00028; // from WMS 1.3.0 spec section 7.2.4.6.9
  var tileWidth = 256;

  var circumferenceAtEquator = 2 * Math.PI * Ellipsoid.WGS84.maximumRadius;
  var distancePerPixelAtLevel0 = circumferenceAtEquator / tileWidth;
  var level0ScaleDenominator = distancePerPixelAtLevel0 / metersPerPixel;

  // 1e-6 epsilon from WMS 1.3.0 spec, section 7.2.4.6.9.
  var ratio = level0ScaleDenominator / (minScaleDenominator - 1e-6);
  var levelAtMinScaleDenominator = Math.log(ratio) / Math.log(2);
  return levelAtMinScaleDenominator | 0;
}

// This is copied directly from Cesium's WebMapServiceImageryProvider.
function objectToLowercase(obj) {
  var result = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key.toLowerCase()] = obj[key];
    }
  }
  return result;
}

function computeLegendUrls(catalogItem) {
  var result = [];
  var layers = catalogItem._allLayersInRawMetadata;
  if (!defined(layers)) {
    return result;
  }

  var styles = catalogItem.styles.split(",");

  if (styles.length === 1 && styles[0] === "") {
    styles = [];
  }

  // Find or create a legend for each layer we're using
  for (var i = 0; i < layers.length; ++i) {
    var legend = computeLegendForLayer(catalogItem, layers[i], styles[i]);
    if (defined(legend)) {
      result.push(legend);
    }
  }

  return result;
}

function computeLegendForLayer(catalogItem, thisLayer, styleName) {
  var legendUri, legendMimeType;

  // If we're using a specific styleName, use the legend associated with that style (if any).
  // Otherwise, use the legend associated with the first style in the list.
  var style = Array.isArray(thisLayer.Style)
    ? thisLayer.Style[0]
    : thisLayer.Style;
  if (defined(styleName)) {
    if (Array.isArray(thisLayer.Style)) {
      for (var i = 0; i < thisLayer.Style.length; ++i) {
        if (thisLayer.Style[i].Name === styleName) {
          style = thisLayer.Style[i];
        }
      }
    } else {
      if (defined(thisLayer.Style) && thisLayer.Style.styleName === styleName) {
        style = thisLayer.Style;
      }
    }
  }

  if (defined(style) && defined(style.LegendURL)) {
    // Use the legend from the style.
    // According to the WMS schema, LegendURL is unbounded.  Use the first legend in the style.
    var legendUrl = Array.isArray(style.LegendURL)
      ? style.LegendURL[0]
      : style.LegendURL;
    if (
      defined(legendUrl) &&
      defined(legendUrl.OnlineResource) &&
      defined(legendUrl.OnlineResource["xlink:href"])
    ) {
      legendUri = new URI(
        decodeURIComponent(legendUrl.OnlineResource["xlink:href"])
      );
      legendMimeType = legendUrl.Format;
    }
  }

  if (!defined(legendUri)) {
    // Construct a GetLegendGraphic request.
    legendUri = new URI(
      cleanUrl(catalogItem.url) +
        "?service=WMS&version=1.1.0&request=GetLegendGraphic&format=image/png&transparent=True&layer=" +
        encodeURIComponent(thisLayer.Name)
    );
    if (defined(style) && defined(style.Name))
      legendUri.addQuery("styles", style.Name);

    legendMimeType = "image/png";
  }

  if (defined(legendUri)) {
    // Tweak the URL to produce a better looking legend when possible.
    if (legendUri.toString().match(/GetLegendGraphic/i)) {
      if (catalogItem.isGeoServer) {
        legendUri.setQuery("version", "1.1.0");
        var legendOptions = "fontSize:14;forceLabels:on;fontAntiAliasing:true";
        legendUri.setQuery("transparent", "True"); // remove if our background is no longer light
        // legendOptions += ';fontColor:0xDDDDDD' // enable if we can ensure a dark background
        // legendOptions += ';dpi:182';           // enable if we can scale the image back down by 50%.
        legendUri.setQuery("LEGEND_OPTIONS", legendOptions);
      } else if (catalogItem.isEsri) {
        // This sets the total dimensions of the legend, but if we don't know how many styles are included, we could make it worse
        // In some cases (eg few styles), we could increase the height to give them more room. But if we always force the height
        // and there are many styles, they'll end up very cramped. About the only solution would be to fetch the default legend, and then ask
        // for a legend that's a bit bigger than the default.
        // uri.setQuery('width', '300');
        // uri.setQuery('height', '300');
      }

      // Include all of the parameters in the legend URI as well.
      if (defined(catalogItem.parameters)) {
        for (var key in catalogItem.parameters) {
          if (catalogItem.parameters.hasOwnProperty(key)) {
            legendUri.setQuery(key, catalogItem.parameters[key]);
          }
        }
      }

      if (
        defined(catalogItem.colorScaleMinimum) &&
        defined(catalogItem.colorScaleMaximum) &&
        !defined(catalogItem.parameters.colorscalerange)
      ) {
        legendUri.setQuery(
          "colorscalerange",
          [catalogItem.colorScaleMinimum, catalogItem.colorScaleMaximum].join(
            ","
          )
        );
      }
    }

    return new LegendUrl(
      addToken(
        legendUri.toString(),
        catalogItem.tokenParameterName,
        catalogItem._lastToken
      ),
      legendMimeType
    );
  }

  return undefined;
}

module.exports = WebMapServiceCatalogItem;
