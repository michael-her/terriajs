"use strict";

/*global require*/
var URI = require("urijs");

var clone = require("terriajs-cesium/Source/Core/clone").default;
var defined = require("terriajs-cesium/Source/Core/defined").default;

var knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
var loadJson = require("../Core/loadJson");

var TerriaError = require("../Core/TerriaError");
var CatalogGroup = require("./CatalogGroup");
var inherit = require("../Core/inherit");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");
var WebMapServiceCatalogItem = require("./WebMapServiceCatalogItem");
var GeowaveVectorTileCatalogItem = require("./GeowaveVectorTileCatalogItem");
var xml2json = require("../ThirdParty/xml2json");
var i18next = require("i18next").default;

/**
 * A {@link CatalogGroup} representing a collection of layers from a Geowave server.
 *
 * @alias GeowaveCatalogGroup
 * @constructor
 * @extends CatalogGroup
 *
 * @param {Terria} terria The Terria instance.
 */
var GeowaveCatalogGroup = function(terria) {
  CatalogGroup.call(this, terria, "geowave");

  /**
   * Gets or sets the URL of the Geowave server.  This property is observable.
   * @type {String}
   */
  this.url = "";

  /**
   * Gets or sets a description of the custodian of the data sources in this group.
   * This property is an HTML string that must be sanitized before display to the user.
   * This property is observable.
   * @type {String}
   * @editorformat textarea
   */
  this.dataCustodian = undefined;

  /**
   * Gets or sets the additional parameters to pass to the Geowave server when requesting images.
   * All parameter names must be entered in lowercase in order to be consistent with references in TerrisJS code.
   * If this property is undefiend, {@link WebMapServiceCatalogItem.defaultParameters} is used.
   * @type {Object}
   */
  this.parameters = undefined;

  /**
   * Gets or sets a hash of names of blacklisted data layers.  A layer that appears in this hash
   * will not be shown to the user.  In this hash, the keys should be the Title of the layers to blacklist,
   * and the values should be "true".  This property is observable.
   * @type {Object}
   */
  this.blacklist = undefined;

  /**
   * Gets or sets the field name to use as the primary title in the catalog view: each Geowave layer's
   * "title" (default), "name", or "abstract".
   * @type {String}
   */
  this.titleField = 'name'; // "title";

  /**
   * Gets or sets a hash of properties that will be set on each child item.
   * For example, { 'treat404AsError': false }
   * @type {Object}
   */
  this.itemProperties = undefined;

  /**
   * Gets or sets a value indicating whether the list of layers queried from GetCapabilities should be
   * flattened into a list with no hierarchy.
   * @type {Boolean}
   * @default false
   */
  this.flatten = false;

  knockout.track(this, [
    "url",
    "dataCustodian",
    "parameters",
    "blacklist",
    "titleField",
    "itemProperties",
    "flatten"
  ]);
};

inherit(CatalogGroup, GeowaveCatalogGroup);

Object.defineProperties(GeowaveCatalogGroup.prototype, {
  /**
   * Gets the type of data member represented by this instance.
   * @memberOf GeowaveCatalogGroup.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "geowave";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, such as 'Web Map Service (Geowave)'.
   * @memberOf GeowaveCatalogGroup.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.GeowaveCatalogGroup.webServer");
    }
  },

  /**
   * Gets the set of functions used to serialize individual properties in {@link CatalogMember#serializeToJson}.
   * When a property name on the model matches the name of a property in the serializers object literal,
   * the value will be called as a function and passed a reference to the model, a reference to the destination
   * JSON object literal, and the name of the property.
   * @memberOf GeowaveCatalogGroup.prototype
   * @type {Object}
   */
  serializers: {
    get: function() {
      return GeowaveCatalogGroup.defaultSerializers;
    }
  }
});

/**
 * Gets or sets the set of default serializer functions to use in {@link CatalogMember#serializeToJson}.  Types derived from this type
 * should expose this instance - cloned and modified if necesary - through their {@link CatalogMember#serializers} property.
 * @type {Object}
 */
GeowaveCatalogGroup.defaultSerializers = clone(
  CatalogGroup.defaultSerializers
);

GeowaveCatalogGroup.defaultSerializers.items =
  CatalogGroup.enabledShareableItemsSerializer;

GeowaveCatalogGroup.defaultSerializers.isLoading = function(
  GeowaveGroup,
  json,
  propertyName,
  options
) {};

Object.freeze(GeowaveCatalogGroup.defaultSerializers);

GeowaveCatalogGroup.prototype._getValuesThatInfluenceLoad = function() {
  return [this.url, this.blacklist, this.titleField];
};

GeowaveCatalogGroup.prototype._load = function() {
  var url = cleanAndProxyUrl(this, this.url) + "api/mapviews";

  var that = this;
  return loadJson(url)
    .then(function(json) {
      // Is this really a GetCapabilities response?
      if (!json) {
        throw new TerriaError({
          title: i18next.t(
            "models.GeowaveCatalogGroup.invalidGeowaveServerTitle"
          ),
          message: i18next.t(
            "models.GeowaveCatalogGroup.invalidGeowaveServerMessage",
            {
              email:
                '<a href="mailto:' +
                that.terria.supportEmail +
                '">' +
                that.terria.supportEmail +
                "</a>."
            }
          )
        });
      }

      // Skip the root layer, if there's only one.
      // But use it for the name of this catalog item if the item is currently named by the URL.
      var parentLayer;
      var rootLayers = json;
      if (rootLayers) {
        if (!(rootLayers instanceof Array)) {
          rootLayers = [rootLayers];
        }
        if (rootLayers.length === 1 && rootLayers[0].name) {
          var singleRoot = rootLayers[0];
          if (that.name === that.url) {
            that.name = getNameFromLayer(that, singleRoot);
          }
          parentLayer = singleRoot;
          // rootLayers = singleRoot.Layer;
        }

        //TODO: WebMapServiceCatalogItem를 GeowaveCatalogItem으로 대체
        // var infoDerivedFromCapabilities = {
        //   availableStyles: WebMapServiceCatalogItem.getAllAvailableStylesFromCapabilities(
        //     json
        //   ),
        //   availableDimensions: WebMapServiceCatalogItem.getAllAvailableDimensionsFromCapabilities(
        //     json
        //   )
        // };

        addLayersRecursively(
          that,
          that,
          json,
          rootLayers,
          parentLayer,
          // infoDerivedFromCapabilities
        );
      }
    })
    .otherwise(function(e) {
      throw new TerriaError({
        sender: that,
        title: i18next.t(
          "models.GeowaveCatalogGroup.groupNotAvailableTitle"
        ),
        message: i18next.t(
          "models.GeowaveCatalogGroup.groupNotAvailableMessage",
          {
            email:
              '<a href="mailto:' +
              that.terria.supportEmail +
              '">' +
              that.terria.supportEmail +
              "</a>.",
            appName: that.terria.appName
          }
        )
      });
    });
};

function cleanAndProxyUrl(catalogGroup, url) {
  // Strip off the search portion of the URL
  var uri = new URI(url);
  uri.search("");

  var cleanedUrl = uri.toString();
  return proxyCatalogItemUrl(catalogGroup, cleanedUrl, "1d");
}

function getNameFromLayer(thisGroup, layer) {
  if (thisGroup.titleField === "name") {
    return layer.name;
  }
  return undefined
}

function addLayersRecursively(
  thisGroup,
  parentGroup,
  capabilities,
  layers,
  parent,
  infoDerivedFromCapabilities
) {
  if (!(layers instanceof Array)) {
    layers = [layers];
  }

  for (var i = 0; i < layers.length; ++i) {
    var layer = layers[i];

    // Record this layer's parent, so we can walk up the layer hierarchy looking for inherited properties.
    layer._parent = parent;

    if (thisGroup.blacklist && thisGroup.blacklist[layer.name]) {
      console.log(
        "Provider Feedback: Filtering out " +
          layer.name + " because it is blacklisted."
      );
      continue;
    }

    if (defined(layer.Layer)) {
      var group = parentGroup;
      if (!thisGroup.flatten) {
        // Create a group for this layer
        group = createGeowaveSubGroup(thisGroup, layer);
      }

      // Geowave 1.1.1 spec section 7.1.4.5.2 says any layer with a Name property can be used
      // in the 'layers' parameter of a GetMap request.  This is true in 1.0.0 and 1.3.0 as well.
      var allName = "(All)";
      var originalNameForAll;
      if (defined(layer.name) && layer.name.length > 0) {
        var all = createGeowaveDataSource(
          thisGroup,
          capabilities,
          layer,
          infoDerivedFromCapabilities
        );

        if (!thisGroup.flatten) {
          originalNameForAll = all.name;
          all.name = allName + " " + all.name;
        }

        group.add(all);
      }

      addLayersRecursively(
        thisGroup,
        group,
        capabilities,
        layer.Layer,
        layer,
        infoDerivedFromCapabilities
      );

      if (!thisGroup.flatten) {
        if (
          group.items.length === 1 &&
          group.items[0].name.indexOf(allName) === 0
        ) {
          group.items[0].name = originalNameForAll;
          parentGroup.add(group.items[0]);
        } else if (group.items.length > 0) {
          parentGroup.add(group);
        }
      }
    } else {
      parentGroup.add(
        createGeowaveDataSource(
          thisGroup,
          capabilities,
          layer,
          infoDerivedFromCapabilities
        )
      );
    }
  }
}

function createGeowaveDataSource(
  thisGroup,
  capabilities,
  layer,
  infoDerivedFromCapabilities
) {
  //TODO
  var result = new GeowaveVectorTileCatalogItem(thisGroup.terria);

  result.name = getNameFromLayer(thisGroup, layer);
  result.isGeoServer = layer.serverType === 'geoserver' ? true : false
  result.layer = layer.name; // layer name
  result.url = `${layer.serverURI}/gwc/service/tms/1.0.0/${layer.viewName}@EPSG:900913@pbf/{z}/{x}/{-y}.pbf`
  result.metadataUrl = `${layer.serverURI}/wfs?service=wfs&version=2.0.0&request=DescribeFeatureType&typeName=${layer.viewName}&outputFormat=application/json`
  result.layerMetadataUrl = cleanAndProxyUrl(thisGroup, thisGroup.url) + "api/mapviews/" + layer.name;

  // result.updateFromCapabilities(
  //   capabilities,
  //   false,
  //   layer,
  //   infoDerivedFromCapabilities
  // );

  if (typeof thisGroup.itemProperties === "object") {
    result.updateFromJson(thisGroup.itemProperties);
  }

  return result;
}

function createGeowaveSubGroup(GeowaveGroup, layer) {
  var result = new CatalogGroup(GeowaveGroup.terria);

  if (GeowaveGroup.titleField === "name") {
    result.name = layer.Name;
  } else if (GeowaveGroup.titleField === "abstract") {
    result.name = layer.Abstract;
  } else {
    result.name = layer.Title;
  }

  return result;
}

module.exports = GeowaveCatalogGroup;
