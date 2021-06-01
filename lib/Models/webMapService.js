var URI = require("urijs");
var moment = require("moment");
var i18next = require("i18next").default;

var when = require("terriajs-cesium/Source/ThirdParty/when").default
var Metadata = require("./Metadata");
var MetadataItem = require("./MetadataItem");
var xml2json = require("../ThirdParty/xml2json");
var defined = require("terriajs-cesium/Source/Core/defined").default;
var TerriaError = require("../Core/TerriaError");
var containsAny = require("../Core/containsAny");
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var Rectangle = require("terriajs-cesium/Source/Core/Rectangle").default;
var WebMercatorTilingScheme = require("terriajs-cesium/Source/Core/WebMercatorTilingScheme").default;
var GeographicTilingScheme = require("terriajs-cesium/Source/Core/GeographicTilingScheme").default;
var GetFeatureInfoFormat = require("terriajs-cesium/Source/Scene/GetFeatureInfoFormat").default;
var TimeInterval = require("terriajs-cesium/Source/Core/TimeInterval").default;
var TimeIntervalCollection = require("terriajs-cesium/Source/Core/TimeIntervalCollection").default;
var JulianDate = require("terriajs-cesium/Source/Core/JulianDate").default;
var unionRectangleArray = require("../Map/unionRectangleArray");

export function capabilitiesXmlToJson(item, capabilitiesXml) {
  var json = xml2json(capabilitiesXml);
  if (!defined(json.Capability)) {
    throw new TerriaError({
      title: i18next.t("models.webMapServiceCatalogItem.missingDataTitle"),
      message: i18next.t("models.webMapServiceCatalogItem.missingDataMessage", {
        name: item.name,
        email:
          '<a href="mailto:' +
          item.terria.supportEmail +
          '">' +
          item.terria.supportEmail +
          "</a>.",
        line: "\n"
      })
    });
  }
  updateParentReference(json.Capability);
  return json;
}

export function loadFromCapabilities(item, abstractsToIgnore) {
  var thisLayer = item._thisLayerInRawMetadata;
  if (!defined(thisLayer)) {
    return;
  }

  var overwrite = item._overwriteFromGetCapabilities;
  var capabilities = item._rawMetadata;

  if (
    !containsAny(thisLayer.Abstract, abstractsToIgnore)
  ) {
    updateInfoSection(
      item,
      overwrite,
      i18next.t("models.webMapServiceCatalogItem.dataDescription"),
      thisLayer.Abstract
    );
  }

  var service = defined(capabilities.Service) ? capabilities.Service : {};

  // Show the service abstract if there is one, and if it isn't the Geoserver default "A compliant implementation..."
  if (
    !containsAny(
      service.Abstract,
      abstractsToIgnore
    ) &&
    service.Abstract !== thisLayer.Abstract
  ) {
    updateInfoSection(
      item,
      overwrite,
      i18next.t("models.webMapServiceCatalogItem.serviceDescription"),
      service.Abstract
    );
  }

  // If style is defined in parameters, use that, but only if a style with that name can be found.
  // Otherwise use first style in list.
  var style = Array.isArray(thisLayer.Style)
    ? thisLayer.Style[0]
    : thisLayer.Style;
  if (defined(item.parameters.styles)) {
    var styleName = item.parameters.styles;
    if (Array.isArray(thisLayer.Style)) {
      for (var ind = 0; ind < thisLayer.Style.length; ind++) {
        if (thisLayer.Style[ind].Name === styleName) {
          style = thisLayer.Style[ind];
        }
      }
    } else {
      if (defined(thisLayer.style) && thisLayer.style.styleName === styleName) {
        style = thisLayer.style;
      }
    }
  }

  if (defined(style) && defined(style.MetadataURL)) {
    var metadataUrls = (Array.isArray(style.MetadataURL)
      ? style.MetadataURL
      : [style.MetadataURL]
    )
      .map(function(metadataUrl) {
        return metadataUrl && metadataUrl.OnlineResource
          ? metadataUrl.OnlineResource["xlink:href"]
          : undefined;
      })
      .filter(url => defined(url))
      .join("<br>");

    updateInfoSection(
      item,
      overwrite,
      i18next.t("models.webMapServiceCatalogItem.metadataUrls"),
      metadataUrls
    );
  }

  // Show the Access Constraints if it isn't "none" (because that's the default, and usually a lie).
  if (
    defined(service.AccessConstraints) &&
    !/^none$/i.test(service.AccessConstraints)
  ) {
    updateInfoSection(
      item,
      overwrite,
      i18next.t("models.webMapServiceCatalogItem.accessConstraints"),
      service.AccessConstraints
    );
  }

  // michael: no default Access Constrains
  // updateInfoSection(
  //   item,
  //   overwrite,
  //   i18next.t("models.webMapServiceCatalogItem.accessConstraints"),
  //   getServiceContactInformation(capabilities)
  // );

  updateInfoSection(
    item,
    overwrite,
    i18next.t("models.webMapServiceCatalogItem.getCapabilitiesUrl"),
    item.getCapabilitiesUrl
  );

  updateValue(
    item,
    overwrite,
    "minScaleDenominator",
    thisLayer.MinScaleDenominator
  );
  updateValue(
    item,
    overwrite,
    "getFeatureInfoFormats",
    getFeatureInfoFormats(capabilities)
  );
  updateValue(
    item,
    overwrite,
    "rectangle",
    getRectangleFromLayers(item._allLayersInRawMetadata)
  );
  updateValue(
    item,
    overwrite,
    "intervals",
    getIntervalsFromLayer(item, thisLayer)
  );

  var crs = defaultValue(
    getInheritableProperty(thisLayer, "CRS", true),
    getInheritableProperty(thisLayer, "SRS", true)
  );

  var tilingScheme;
  var srs;

  if (defined(crs)) {
    if (crsIsMatch(crs, "EPSG:3857")) {
      // Standard Web Mercator
      tilingScheme = new WebMercatorTilingScheme();
      srs = "EPSG:3857";
    } else if (crsIsMatch(crs, "EPSG:900913")) {
      // Older code for Web Mercator
      tilingScheme = new WebMercatorTilingScheme();
      srs = "EPSG:900913";
    } else if (crsIsMatch(crs, "EPSG:4326")) {
      // Standard Geographic
      tilingScheme = new GeographicTilingScheme();
      srs = "EPSG:4326";
    } else if (crsIsMatch(crs, "CRS:84")) {
      // Another name for EPSG:4326
      tilingScheme = new GeographicTilingScheme();
      srs = "CRS:84";
    } else if (crsIsMatch(crs, "EPSG:4283")) {
      // Australian system that is equivalent to EPSG:4326.
      tilingScheme = new GeographicTilingScheme();
      srs = "EPSG:4283";
    } else {
      // No known supported CRS listed.  Try the default, EPSG:3857, and hope for the best.
      tilingScheme = new WebMercatorTilingScheme();
      srs = "EPSG:3857";
    }
  }

  updateValue(item, overwrite, "tilingScheme", tilingScheme);

  if (!defined(item.parameters)) {
    item.parameters = {};
  }
  updateValue(item.parameters, overwrite, "srs", srs);

  if (item.supportsColorScaleRange) {
    updateValue(item, overwrite, "colorScaleMinimum", -50);
    updateValue(item, overwrite, "colorScaleMaximum", 50);
  }
}

export function addToken(url, tokenParameterName, token) {
  if (!defined(token)) {
    return url;
  } else {
    return new URI(url).setQuery(tokenParameterName, token).toString();
  }
}

/* Given a comma-separated string of layer names, returns the layer objects corresponding to them. */
export function findLayers(startLayer, names) {
  return names.split(",").map(function(name) {
    // Look for an exact match on the name.
    let match = findLayer(startLayer, name, false);

    if (!match) {
      const colonIndex = name.indexOf(":");
      if (colonIndex >= 0) {
        // This looks like a namespaced name.  Such names will (usually?) show up in GetCapabilities
        // as just their name without the namespace qualifier.
        const nameWithoutNamespace = name.substring(colonIndex + 1);
        match = findLayer(startLayer, nameWithoutNamespace, false);
      }
    }

    if (!match) {
      // Try matching by title.
      match = findLayer(startLayer, name, true);
    }

    return match;
  });
}

export function findLayer(startLayer, name, allowMatchByTitle) {
  if (
    startLayer.Name === name ||
    (allowMatchByTitle && startLayer.Title === name && defined(startLayer.Name))
  ) {
    return startLayer;
  }

  var layers = startLayer.Layer;
  if (!defined(layers)) {
    return undefined;
  }

  var found = findLayer(layers, name, allowMatchByTitle);
  for (var i = 0; !found && i < layers.length; ++i) {
    var layer = layers[i];
    found = findLayer(layer, name, allowMatchByTitle);
  }

  return found;
}

export function requestMetadata(wmsItem) {
  var result = new Metadata();

  result.isLoading = true;

  result.promise = when(wmsItem.load())
    .then(function() {
      var json = wmsItem._rawMetadata;
      if (json && json.Service) {
        populateMetadataGroup(result.serviceMetadata, json.Service);
      } else {
        result.serviceErrorMessage =
          "Service information not found in GetCapabilities operation response.";
      }

      if (wmsItem._thisLayerInRawMetadata) {
        populateMetadataGroup(
          result.dataSourceMetadata,
          wmsItem._thisLayerInRawMetadata
        );
      } else {
        result.dataSourceErrorMessage =
          "Layer information not found in GetCapabilities operation response.";
      }

      result.isLoading = false;
    })
    .otherwise(function() {
      result.dataSourceErrorMessage =
        "An error occurred while invoking the GetCapabilities service.";
      result.serviceErrorMessage =
        "An error occurred while invoking the GetCapabilities service.";
      result.isLoading = false;
    });

  return result;
}

function populateMetadataGroup(metadataGroup, sourceMetadata) {
  if (typeof sourceMetadata === "string" || sourceMetadata instanceof String) {
    return;
  }

  for (var name in sourceMetadata) {
    if (sourceMetadata.hasOwnProperty(name) && name !== "_parent") {
      var value = sourceMetadata[name];

      var dest;
      if (name === "BoundingBox" && value instanceof Array) {
        for (var i = 0; i < value.length; ++i) {
          var subValue = value[i];

          dest = new MetadataItem();
          dest.name = name + " (" + subValue.CRS + ")";
          dest.value = subValue;

          populateMetadataGroup(dest, subValue);

          metadataGroup.items.push(dest);
        }
      } else {
        dest = new MetadataItem();
        dest.name = name;
        dest.value = value;

        populateMetadataGroup(dest, value);

        metadataGroup.items.push(dest);
      }
    }
  }
}

function updateParentReference(capabilitiesJson, parent) {
  capabilitiesJson._parent = parent;

  var layers = capabilitiesJson.Layer;

  if (layers instanceof Array) {
    for (var i = 0; i < layers.length; ++i) {
      updateParentReference(layers[i], capabilitiesJson);
    }
  } else if (defined(layers)) {
    updateParentReference(layers, capabilitiesJson);
  }
}

function updateInfoSection(item, overwrite, sectionName, sectionValue) {
  if (!defined(sectionValue) || sectionValue.length === 0) {
    return;
  }

  var section = item.findInfoSection(sectionName);
  if (!defined(section)) {
    item.info.push({
      name: sectionName,
      content: sectionValue
    });
  } else if (overwrite) {
    section.content = sectionValue;
  }
}

function updateValue(item, overwrite, propertyName, propertyValue) {
  if (!defined(propertyValue)) {
    return;
  }

  if (overwrite || !defined(item[propertyName])) {
    item[propertyName] = propertyValue;
  }
}

function getServiceContactInformation(capabilities) {
  if (defined(capabilities.Service.ContactInformation)) {
    var contactInfo = capabilities.Service.ContactInformation;

    var text = "";

    var primary = contactInfo.ContactPersonPrimary;
    if (defined(primary)) {
      if (
        defined(primary.ContactOrganization) &&
        primary.ContactOrganization.length > 0
      ) {
        text += primary.ContactOrganization + "<br/>";
      }
    }

    if (
      defined(contactInfo.ContactElectronicMailAddress) &&
      contactInfo.ContactElectronicMailAddress.length > 0
    ) {
      text +=
        "[" +
        contactInfo.ContactElectronicMailAddress +
        "](mailto:" +
        contactInfo.ContactElectronicMailAddress +
        ")";
    }

    return text;
  } else {
    return undefined;
  }
}

function getFeatureInfoFormats(capabilities) {
  var supportsJsonGetFeatureInfo = false;
  var supportsXmlGetFeatureInfo = false;
  var supportsHtmlGetFeatureInfo = false;
  var xmlContentType = "text/xml";

  if (
    defined(capabilities.Capability.Request) &&
    defined(capabilities.Capability.Request.GetFeatureInfo) &&
    defined(capabilities.Capability.Request.GetFeatureInfo.Format)
  ) {
    var format = capabilities.Capability.Request.GetFeatureInfo.Format;
    if (format === "application/json") {
      supportsJsonGetFeatureInfo = true;
    } else if (
      defined(format.indexOf) &&
      format.indexOf("application/json") >= 0
    ) {
      supportsJsonGetFeatureInfo = true;
    }

    if (format === "text/xml" || format === "application/vnd.ogc.gml") {
      supportsXmlGetFeatureInfo = true;
      xmlContentType = format;
    } else if (defined(format.indexOf) && format.indexOf("text/xml") >= 0) {
      supportsXmlGetFeatureInfo = true;
      xmlContentType = "text/xml";
    } else if (
      defined(format.indexOf) &&
      format.indexOf("application/vnd.ogc.gml") >= 0
    ) {
      supportsXmlGetFeatureInfo = true;
      xmlContentType = "application/vnd.ogc.gml";
    } else if (defined(format.indexOf) && format.indexOf("text/html") >= 0) {
      supportsHtmlGetFeatureInfo = true;
    }
  }

  var result = [];

  if (supportsJsonGetFeatureInfo) {
    result.push(new GetFeatureInfoFormat("json"));
  }
  if (supportsXmlGetFeatureInfo) {
    result.push(new GetFeatureInfoFormat("xml", xmlContentType));
  }
  if (supportsHtmlGetFeatureInfo) {
    result.push(new GetFeatureInfoFormat("html"));
  }

  return result;
}

function getRectangleFromLayers(layers) {
  if (!Array.isArray(layers)) {
    return getRectangleFromLayer(layers);
  }

  return unionRectangleArray(
    layers.map(function(item) {
      return getRectangleFromLayer(item);
    })
  );
}

function getRectangleFromLayer(layer) {
  var egbb = layer.EX_GeographicBoundingBox; // required in WMS 1.3.0
  if (defined(egbb)) {
    return Rectangle.fromDegrees(
      egbb.westBoundLongitude,
      egbb.southBoundLatitude,
      egbb.eastBoundLongitude,
      egbb.northBoundLatitude
    );
  } else {
    var llbb = layer.LatLonBoundingBox; // required in WMS 1.0.0 through 1.1.1
    if (defined(llbb)) {
      return Rectangle.fromDegrees(llbb.minx, llbb.miny, llbb.maxx, llbb.maxy);
    }
  }
  return undefined;
}

function getIntervalsFromLayer(wmsItem, layer) {
  var dimensions = wmsItem.availableDimensions[layer.Name];

  if (!defined(dimensions)) {
    return undefined;
  }

  if (!(dimensions instanceof Array)) {
    dimensions = [dimensions];
  }

  var result = new TimeIntervalCollection();

  for (var i = 0; i < dimensions.length; ++i) {
    var dimension = dimensions[i];

    if (dimension.name && dimension.name.toLowerCase() !== "time") {
      continue;
    }

    var times = dimension.options;

    for (var j = 0; j < times.length; ++j) {
      var isoSegments = times[j].split("/");
      if (isoSegments.length > 1) {
        updateIntervalsFromIsoSegments(result, isoSegments, times[j], wmsItem);
      } else {
        updateIntervalsFromTimes(result, times, j, wmsItem.displayDuration);
      }
    }
  }

  return result;
}

function getInheritableProperty(layer, name, appendValues) {
  var value = [];
  while (defined(layer)) {
    if (defined(layer[name])) {
      if (appendValues) {
        value = value.concat(
          layer[name] instanceof Array ? layer[name] : [layer[name]]
        );
      } else {
        return layer[name];
      }
    }
    layer = layer._parent;
  }

  return value.length > 0 ? value : undefined;
}

function crsIsMatch(crs, matchValue) {
  if (crs === matchValue) {
    return true;
  }

  if (crs instanceof Array && crs.indexOf(matchValue) >= 0) {
    return true;
  }

  return false;
}

function updateIntervalsFromIsoSegments(intervals, isoSegments, time, wmsItem) {
  // Note parseZone will create a moment with the original specified UTC offset if there is one,
  // but if not, it will create a moment in UTC.
  var start = moment.parseZone(isoSegments[0]);
  var stop = moment.parseZone(isoSegments[1]);

  if (isoSegments.length === 2) {
    // Does this situation ever arise?  The standard is confusing:
    // Section 7.2.4.6.10 of the standard, defining getCapabilities, refers to sections 6.7.5 through 6.7.7.
    // Section 6.7.6 is about Temporal CS, and says in full:
    //     Some geographic information may be available at multiple times (for example, an hourly weather map). A WMS
    //     may announce available times in its service metadata, and the GetMap operation includes a parameter for
    //     requesting a particular time. The format of a time string is specified in Annex D. Depending on the context, time
    //     values may appear as a single value, a list of values, or an interval, as specified in Annex C. When providing
    //     temporal information, a server should declare a default value in service metadata, and a server shall respond with
    //     the default value if one has been declared and the client request does not include a value.
    // Annex D says only moments and periods are allowed - it does not mention intervals.
    // Annex C describes how to request layers - not what getCapabilities returns: but it does allow for intervals.
    //     In either case, value uses the format described in Table C.2 to provide a single value, a comma-separated list, or
    //     an interval of the form start/end without a resolution... An interval in a request
    //     value is a request for all the data from the start value up to and including the end value.
    // This seems to imply getCapabilities should only return dates or periods, but that you can request a period, and receive
    // a server-defined aggregation of the layers in that period.
    //
    // But MapServer actually gives an example getCapabilities which contains a period:
    //     http://mapserver.org/ogc/wms_time.html#getcapabilities-output
    //     <Extent name="time" default="2004-01-01 14:10:00" nearestValue="0">2004-01-01/2004-02-01</Extent>
    // The standard defines nearestValue such that: 0 = request value(s) must correspond exactly to declared extent value(s),
    // and yet the default is not exactly a declared extend value.
    // So it looks like Map Server defines a period in GetCapabilities, but actually wants it requested using a date,
    // not a period, and that any date in that interval will return the same thing.
    intervals.addInterval(
      new TimeInterval({
        start: JulianDate.fromIso8601(start.format()),
        stop: JulianDate.fromIso8601(stop.format()),
        data: start // Convert the period to a date for requests (see discussion above).
      })
    );
  } else {
    // Note WMS uses extension ISO19128 of ISO8601; ISO 19128 allows start/end/periodicity
    // and does not use the "R[n]/" prefix for repeated intervals
    // eg. Data refreshed every 30 min: 2000-06-18T14:30Z/2000-06-18T14:30Z/PT30M
    // See 06-042_OpenGIS_Web_Map_Service_WMS_Implementation_Specification.pdf section D.4
    var duration = moment.duration(isoSegments[2]);
    if (
      duration.isValid() &&
      (duration.milliseconds() > 0 ||
        duration.seconds() > 0 ||
        duration.minutes() > 0 ||
        duration.hours() > 0 ||
        duration.days() > 0 ||
        duration.weeks() > 0 ||
        duration.months() > 0 ||
        duration.years() > 0)
    ) {
      var thisStop = start.clone();
      var prevStop = start;
      var stopDate = stop;
      var count = 0;

      // Add intervals starting at start until:
      //    we go past the stop date, or
      //    we go past the max limit
      while (
        thisStop &&
        prevStop.isSameOrBefore(stopDate) &&
        count < wmsItem.maxRefreshIntervals
      ) {
        thisStop.add(duration);
        intervals.addInterval(
          new TimeInterval({
            start: JulianDate.fromIso8601(prevStop.format()),
            stop: JulianDate.fromIso8601(thisStop.format()),
            data: formatMomentForWms(prevStop, duration) // used to form the web request
          })
        );
        prevStop = thisStop.clone();
        ++count;
      }
    } else {
      wmsItem.terria.error.raiseEvent(
        new TerriaError({
          title: i18next.t(
            "models.webMapServiceCatalogItem.badlyFormatedTitle"
          ),
          message: i18next.t(
            "models.webMapServiceCatalogItem.badlyFormatedMessage",
            { name: wmsItem.name, isoSegments: isoSegments[2] }
          )
        })
      );
    }
  }
}

function updateIntervalsFromTimes(result, times, index, defaultDuration) {
  var start = JulianDate.fromIso8601(times[index]);
  var stop;

  if (defaultDuration) {
    stop = JulianDate.addMinutes(start, defaultDuration, new JulianDate());
  } else if (index < times.length - 1) {
    // if the next date has a slash in it, just use the first part of it
    var nextTimeIsoSegments = times[index + 1].split("/");
    stop = JulianDate.fromIso8601(nextTimeIsoSegments[0]);
  } else if (result.length > 0) {
    var previousInterval = result.get(result.length - 1);
    var duration = JulianDate.secondsDifference(
      previousInterval.stop,
      previousInterval.start
    );
    stop = JulianDate.addSeconds(start, duration, new JulianDate());
  } else {
    // There's exactly one timestamp, so we set stop = start.
    stop = start;
  }
  result.addInterval(
    new TimeInterval({
      start: start,
      stop: stop,
      data: times[index]
    })
  );
}

function formatMomentForWms(m, duration) {
  // If the original moment only contained a date (not a time), and the
  // duration doesn't include hours, minutes, or seconds, format as a date
  // only instead of a date+time.  Some WMS servers get confused when
  // you add a time on them.
  if (
    duration.hours() > 0 ||
    duration.minutes() > 0 ||
    duration.seconds() > 0 ||
    duration.milliseconds() > 0
  ) {
    return m.format();
  } else if (m.creationData().format.indexOf("T") >= 0) {
    return m.format();
  } else {
    return m.format(m.creationData().format);
  }
}
