"use strict";

import i18next from "i18next";
/*global require*/
var computeRingWindingOrder = require("./computeRingWindingOrder");
var WebMercatorTilingScheme = require("terriajs-cesium/Source/Core/WebMercatorTilingScheme").default;
var Rectangle = require("terriajs-cesium/Source/Core/Rectangle").default;
var CesiumEvent = require("terriajs-cesium/Source/Core/Event").default;
var defined = require("terriajs-cesium/Source/Core/defined").default;
var VectorTile = require("@mapbox/vector-tile").VectorTile;
var Protobuf = require("pbf");
var Point = require("@mapbox/point-geometry");
var loadArrayBuffer = require("../Core/loadArrayBuffer");
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var DeveloperError = require("terriajs-cesium/Source/Core/DeveloperError").default;
var URITemplate = require("urijs/src/URITemplate");
var Cartographic = require("terriajs-cesium/Source/Core/Cartographic").default;
var Cartesian2 = require("terriajs-cesium/Source/Core/Cartesian2").default;
var BoundingRectangle = require("terriajs-cesium/Source/Core/BoundingRectangle").default;
var Intersect = require("terriajs-cesium/Source/Core/Intersect").default;
var WindingOrder = require("terriajs-cesium/Source/Core/WindingOrder").default;
import KeplerTable from "../Utils/table-utils/kepler-table";
import { ALL_FIELD_TYPES, NO_VALUE_COLOR, SCALE_TYPES, SCALE_FUNC, CHANNEL_SCALES } from '../Constants/default-settings';
import rgba from 'rgba-convert'
import { notNullorUndefined } from '../Utils/data-utils';
import {hexToRgb, getColorGroupByName, reverseColorRange} from '../Utils/color-utils';
// import { console, Object } from "global";
import Console from 'global/console';
import { Promise } from "global";
import _ from 'lodash'
import memoize from 'fast-memoize'
import Resource from 'terriajs-cesium/Source/Core/Resource'

var POINT_FEATURE = 1;
var POLYLINE_FEATURE = 2;
var POLYGON_FEATURE = 3; // feature.type == 3 for polygon features
var MAX_TILE_CACHE = 64;

var GeowaveVectorTileImageryProvider = function(options) {

  // michael

  // reverse y 타일 스키마를 지원하기 위해 URL을 조작함
  this._originalUrl = options.url

  // CatalogItem 이 data를 가짐
  this._data = options.data
  
  // 타일 리퀘스트 풀
  // 오래된 타일에 대한 요청을 취소하기 위한 장치 (from OpenLayers)
  this._tileCache = defaultValue(options.cache, {order: [], promise: {}, request: {}})

  this._styleCache = defaultValue(options.styleCache, {table: null, accessors: null, computeCss: null})

  // reverse y 타일 스키마를 지원하기 위해 URL을 조작함
  this._uriTemplate = new URITemplate(options.url.replace("{-y}", "{y}"));
  // this._uriTemplate = new URITemplate(options.url);

  if (typeof options.layerName !== "string") {
    throw new DeveloperError(
      i18next.t("map.geowaveVectorTileImageryProvider.requireLayerName")
    );
  }
  this._layerName = options.layerName;

  this._subdomains = defaultValue(options.subdomains, []);

  if (!(options.styleFunc instanceof Function)) {
    throw new DeveloperError(
      i18next.t("map.geowaveVectorTileImageryProvider.requireStyles")
    );
  }
  this._styleFunc = options.styleFunc;

  this._tilingScheme = new WebMercatorTilingScheme();

  this._tileWidth = 256;
  this._tileHeight = 256;

  this._minimumLevel = defaultValue(options.minimumZoom, 0);
  this._maximumLevel = defaultValue(options.maximumZoom, Infinity);
  this._maximumNativeLevel = defaultValue(
    options.maximumNativeZoom,
    this._maximumLevel
  );

  this._rectangle = defined(options.rectangle)
    ? Rectangle.intersection(options.rectangle, this._tilingScheme.rectangle)
    : this._tilingScheme.rectangle;
  this._uniqueIdProp = options.uniqueIdProp;
  this._featureInfoFunc = options.featureInfoFunc;
  this._refreshFunc = options.refreshFunc;
  //this._featurePicking = options.featurePicking;

  // Check the number of tiles at the minimum level.  If it's more than four,
  // throw an exception, because starting at the higher minimum
  // level will cause too many tiles to be downloaded and rendered.
  var swTile = this._tilingScheme.positionToTileXY(
    Rectangle.southwest(this._rectangle),
    this._minimumLevel
  );
  var neTile = this._tilingScheme.positionToTileXY(
    Rectangle.northeast(this._rectangle),
    this._minimumLevel
  );
  var tileCount =
    (Math.abs(neTile.x - swTile.x) + 1) * (Math.abs(neTile.y - swTile.y) + 1);
  if (tileCount > 4) {
    throw new DeveloperError(
      i18next.t("map.geowaveVectorTileImageryProvider.moreThanFourTiles", {
        tileCount: tileCount
      })
    );
  }

  this._errorEvent = new CesiumEvent();

  this._ready = true;
};

Object.defineProperties(GeowaveVectorTileImageryProvider.prototype, {
  url: {
    get: function() {
      return this._uriTemplate.expression;
    }
  },

  tileWidth: {
    get: function() {
      return this._tileWidth;
    }
  },

  tileHeight: {
    get: function() {
      return this._tileHeight;
    }
  },

  maximumLevel: {
    get: function() {
      return this._maximumLevel;
    }
  },

  minimumLevel: {
    get: function() {
      return this._minimumLevel;
    }
  },

  tilingScheme: {
    get: function() {
      return this._tilingScheme;
    }
  },

  rectangle: {
    get: function() {
      return this._rectangle;
    }
  },

  errorEvent: {
    get: function() {
      return this._errorEvent;
    }
  },

  ready: {
    get: function() {
      return this._ready;
    }
  },

  hasAlphaChannel: {
    get: function() {
      return true;
    }
  },

});

GeowaveVectorTileImageryProvider.prototype._getSubdomain = function(
  x,
  y,
  level
) {
  if (this._subdomains.length === 0) {
    return undefined;
  } else {
    var index = (x + y + level) % this._subdomains.length;
    return this._subdomains[index];
  }
};

GeowaveVectorTileImageryProvider.prototype._buildImageUrl = function(
  x,
  y,
  level
) {
  // michael: reverse y 계산
  y = this._originalUrl.indexOf("{-y}") != -1 ? Math.pow(2, level) - y - 1 : y;
  return this._uriTemplate.expand({
    z: level,
    x,
    y,
    s: this._getSubdomain(x, y, level)
  });
};

GeowaveVectorTileImageryProvider.prototype.requestImage = function(x, y, level) {
  // Console.log('[provider.requestImage]', {x, y, level})
  var canvas = document.createElement("canvas");
  canvas.width = this._tileWidth;
  canvas.height = this._tileHeight;
  return this._requestImage(x, y, level, canvas);
};

GeowaveVectorTileImageryProvider.prototype._requestImage = function(
  x,
  y,
  level,
  canvas
) {
  var requestedTile = {
    x: x,
    y: y,
    level: level
  };
  var nativeTile; // The level, x & y of the tile used to draw the requestedTile
  // Check whether to use a native tile or overzoom the largest native tile
  if (level > this._maximumNativeLevel) {
    // Determine which native tile to use
    var levelDelta = level - this._maximumNativeLevel;
    nativeTile = {
      x: x >> levelDelta,
      y: y >> levelDelta,
      level: this._maximumNativeLevel
    };
  } else {
    nativeTile = requestedTile;
  }

  var url = this._buildImageUrl(nativeTile.x, nativeTile.y, nativeTile.level);

  const compareZoomFn = it => {
    // lowest level to right for delete/cancel request
    return this._maximumLevel - it.tile.level
  }

  // CACHE
  // michael
  if (this._tileCache.promise[url]) {
    return this._tileCache.promise[url]
  } else { // not requested
    // Console.log(`[provider._requestImage] ${this._tileCache.order.length}/${MAX_TILE_CACHE}`)
    if (this._tileCache.order.length >= MAX_TILE_CACHE) {
      const [order] = this._tileCache.order.splice(this._tileCache.order.length - 1, 1)
      // Console.log(`[provider._requestImage] abort pending`, order.url)
      delete this._tileCache.promise[order.url]
      if (this._tileCache.request[order.url].cancelFunction) {
        this._tileCache.request[order.url].cancelFunction() // abort pending request
      }
      delete this._tileCache.request[order.url]
      // Console.log('[provider._requestImage] ', {
      //   order: this._tileCache.order.length,
      //   request: Object.keys(this._tileCache.request).length,
      //   promise: Object.keys(this._tileCache.promise).length,
      // })
    }
    this._tileCache.order.push({url, tile: nativeTile})
    // MUST sorted
    this._tileCache.order = _.sortBy(this._tileCache.order, compareZoomFn)
    
    const resource = Resource.createIfNeeded(url);
    this._tileCache.request[url] = resource.request
    this._tileCache.promise[url] = resource.fetchArrayBuffer().then(data => {
      const ret = this._drawTile(
        requestedTile,
        nativeTile,
        new VectorTile(new Protobuf(data)),
        canvas
      )
      this._tileCache.order.splice(_.findIndex(this._tileCache.order, order => order.url === url))
      delete this._tileCache.request[url]
      delete this._tileCache.promise[url]
      return ret
    })
    return this._tileCache.promise[url]
  }

  // NO CACHE
  // return loadArrayBuffer(url).then(data => {
  //   return this._drawTile(
  //     requestedTile,
  //     nativeTile,
  //     new VectorTile(new Protobuf(data)),
  //     canvas
  //   )
  // });
};

// Use x,y,level vector tile to produce imagery for newX,newY,newLevel
function overzoomGeometry(rings, nativeTile, newExtent, newTile) {
  var diffZ = newTile.level - nativeTile.level;
  if (diffZ === 0) {
    return rings;
  } else {
    var newRings = [];
    // (offsetX, offsetY) is the (0,0) of the new tile
    var offsetX = newExtent * (newTile.x - (nativeTile.x << diffZ));
    var offsetY = newExtent * (newTile.y - (nativeTile.y << diffZ));
    for (var i = 0; i < rings.length; i++) {
      var ring = [];
      for (var i2 = 0; i2 < rings[i].length; i2++) {
        ring.push(rings[i][i2].sub(new Point(offsetX, offsetY)));
      }
      newRings.push(ring);
    }
    return newRings;
  }
}

const defaultDataAccessor = d => d.data;
const defaultGetFieldValue = (field, d) => field.valueAccessor(d);

GeowaveVectorTileImageryProvider.prototype._getColorScale = function(colorScale, colorDomain, colorRange) {
  if (Array.isArray(colorRange.colorMap)) {
    const cMap = new Map();
    colorRange.colorMap.forEach(([k, v]) => {
      cMap.set(k, typeof v === 'string' ? hexToRgb(v) : v);
    });

    const scale = SCALE_FUNC[SCALE_TYPES.ordinal]()
      .domain(cMap.keys())
      .range(cMap.values())
      .unknown(cMap.get(UNKNOWN_COLOR_KEY) || NO_VALUE_COLOR);
    return scale;
  }

  return this._getVisChannelScale(colorScale, colorDomain, colorRange.colors.map(hexToRgb));
}

GeowaveVectorTileImageryProvider.prototype._getVisChannelScale = function(scale, domain, range, fixed) {
  return SCALE_FUNC[fixed ? 'linear' : scale]()
    .domain(domain)
    .range(fixed ? domain : range);
}

GeowaveVectorTileImageryProvider.prototype._getChannelScale = function(scale, domain, range, fixed) {
  return SCALE_FUNC[fixed ? 'linear' : scale]()
    .domain(domain)
    .range(fixed ? domain : range)
}

GeowaveVectorTileImageryProvider.prototype._getEncodedChannelValue = function(
  scale, data, field, nullValue = NO_VALUE_COLOR, getValue = defaultGetFieldValue
) {
  const {localType} = field
  const value = getValue(field, data)

  if (!notNullorUndefined(value)) return nullValue

  let attributeValue
  switch(localType) {
  case ALL_FIELD_TYPES.timestamp:
    // shouldn't need to convert here
    // scale Function should take care of it
    attributeValue = scale(new Date(value))
    break;
  default:
    attributeValue = scale(value)
  }

  // if (localType === ALL_FIELD_TYPES.timestamp) {
  //   // shouldn't need to convert here
  //   // scale Function should take care of it
  //   attributeValue = scale(new Date(value))
  // } else {
  //   attributeValue = scale(value)
  // }

  if (!notNullorUndefined(attributeValue)) {
    attributeValue = nullValue
  }

  return attributeValue
}

/**
 * Mapping from visual channels to accessors
 * @param {Function} dataAccessor access layer data
 * @returns {Object} attributeAccessors - layer attribute accessors
 */
GeowaveVectorTileImageryProvider.prototype._getAttributeAccessor = function(
  channel, field, scale, domain, range, dataAccessor = defaultDataAccessor
) {
  if (field) {
    const args = [scale, domain, range]
    const scaleFunction = channel.channelScaleType === CHANNEL_SCALES.color
      ? this._getColorScale(...args)
      : this._getChannelScale(...args, channel.fixed)
    return d =>
      this._getEncodedChannelValue(scaleFunction, dataAccessor(d), field, channel.nullValue)
  } else if (typeof channel.getAttributeValue === 'function') {
    return channel.getAttributeValue
  } else {
    return typeof channel.defaultValue === 'function' ? defaultValue : defaultValue
  }

  Console.warn(`[provider] Failed to provide accessor function`)
  return null
}

GeowaveVectorTileImageryProvider.prototype._drawTile = function(
  requestedTile,
  nativeTile,
  tile,
  canvas
) {
  var layer = tile.layers[this._layerName];
  if (!defined(layer)) {
    return canvas; // return blank canvas for blank tile
  }

  var context = canvas.getContext('2d');
  context.strokeStyle = 'black';
  context.lineWidth = 1.0;

  var pos;

  var extentFactor = canvas.width / layer.extent; // Vector tile works with extent [0, 4095], but canvas is only [0,255]

  // 도메인 데이터 집계형 스타일을 미리 계산한다.
  let style = this._styleFunc()
  let uniqueIdLess = false
  // FID 없이 _styleFunc()를 호출하였을 때, 반환이 undefined 인 경우, FID를 사용하는 스타일임
  if (!defined(style)) {
    style = this._styleFunc("0")
  } else {
    // FID 없이 스타일을 계산할 수 있다.
    uniqueIdLess = true
  }

  // 처음 한번만 스타일 도메인을 계산한다.
  // install style accessors
  if (!this._styleCache.accessors && this._styleCache.table) {
    // object 스타일이 존재하면 동적 계산 스타일이다.
    this._styleCache.accessors = Object.keys(style)
    .filter(key => typeof style[key] === 'object')
    .reduce((ret, key) => ({
      ...ret,
      [key]: this._getAttributeAccessor(
        style[key].channel,
        style[key].field,
        style[key].scale,
        this._styleCache.table.getColumnFilterDomain(style[key].field).domain, // 실질적인 캐싱 대상
        style[key].range,
        d => d
      )
    }), {})
  }

  // install memoized css color computer
  if (!this._styleCache.computeCss) {
    this._styleCache.computeCss = memoize(val => rgba.css(val))
  }
  const computeCss = this._styleCache.computeCss
  const {fillStyle, strokeStyle, lineWidth} = this._styleCache.accessors || {}

  if (uniqueIdLess) {
    context.fillStyle = fillStyle ? context.fillStyle : style.fillStyle;
    context.strokeStyle = strokeStyle ? context.strokeStyle : style.strokeStyle;
    context.lineWidth = lineWidth ? context.lineWidth : style.lineWidth;
  }
  context.lineJoin = style.lineJoin
  
  const rows = []
  let buffer = undefined

  // Features
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const uniqueId = feature.properties[this._uniqueIdProp]
    style = this._styleFunc(uniqueId);
    // style이 없으면 가시화도 없다. (가시화 데이터 도메인에서도 제외된다)
    if (!style) continue;

    if (this._data.index.add(uniqueId)) {
      rows.push(feature.properties)
    }
    
    let fillColor = fillStyle ? fillStyle(feature.properties) : 'black' // instead of undefined
    let strokeColor = strokeStyle ? strokeStyle(feature.properties) : 'black' // instead of undefined
    
    if (feature.type === POLYGON_FEATURE || feature.type === POLYLINE_FEATURE) {
      if (fillStyle) context.fillStyle = computeCss(rgba.num(fillColor))
      if (strokeStyle) context.strokeStyle = computeCss(rgba.num(strokeColor))
      if (lineWidth) context.lineWidth = lineWidth(feature.properties)
  
      context.beginPath();
      var coordinates;
      if (nativeTile.level !== requestedTile.level) {
        // Overzoom feature
        var bbox = feature.bbox(); // [w, s, e, n] bounding box
        var featureRect = new BoundingRectangle(
          bbox[0],
          bbox[1],
          bbox[2] - bbox[0],
          bbox[3] - bbox[1]
        );
        var levelDelta = requestedTile.level - nativeTile.level;
        var size = layer.extent >> levelDelta;
        if (size < 16) {
          // Tile has less less detail than 16x16
          throw new DeveloperError(
            i18next.t("map.geowaveVectorTileImageryProvider.maxLevelError")
          );
        }
        var x1 = size * (requestedTile.x - (nativeTile.x << levelDelta)); //
        var y1 = size * (requestedTile.y - (nativeTile.y << levelDelta));
        var tileRect = new BoundingRectangle(x1, y1, size, size);
        if (
          BoundingRectangle.intersect(featureRect, tileRect) ===
          Intersect.OUTSIDE
        ) {
          continue;
        }
        extentFactor = canvas.width / size;
        coordinates = overzoomGeometry(
          feature.loadGeometry(),
          nativeTile,
          size,
          requestedTile
        );
      } else {
        coordinates = feature.loadGeometry();
      }

      // Polygon rings
      for (var i2 = 0; i2 < coordinates.length; i2++) {
        pos = coordinates[i2][0];
        context.moveTo(pos.x * extentFactor, pos.y * extentFactor);

        // Polygon ring points
        for (var j = 1; j < coordinates[i2].length; j++) {
          pos = coordinates[i2][j];
          context.lineTo(pos.x * extentFactor, pos.y * extentFactor);
        }
      }
      context.stroke();
      feature.type === POLYGON_FEATURE && context.fill();
    }
    else if (feature.type === POINT_FEATURE) {
      if (fillStyle) context.fillStyle = computeCss(rgba.num(fillColor))
      if (strokeStyle) context.strokeStyle = computeCss(rgba.num(strokeColor))
      context.lineWidth = 0.5
      let radius = lineWidth ? lineWidth(feature.properties) : style.lineWidth

      var coordinates;
      if (nativeTile.level !== requestedTile.level) {
        // Overzoom feature
        var bbox = feature.bbox(); // [w, s, e, n] bounding box
        var featureRect = new BoundingRectangle(
          bbox[0],
          bbox[1],
          bbox[2] - bbox[0],
          bbox[3] - bbox[1]
        );
        var levelDelta = requestedTile.level - nativeTile.level;
        var size = layer.extent >> levelDelta;
        if (size < 16) {
          // Tile has less less detail than 16x16
          throw new DeveloperError(
            i18next.t("map.geowaveVectorTileImageryProvider.maxLevelError")
          );
        }
        var x1 = size * (requestedTile.x - (nativeTile.x << levelDelta)); //
        var y1 = size * (requestedTile.y - (nativeTile.y << levelDelta));
        var tileRect = new BoundingRectangle(x1, y1, size, size);
        if (
          BoundingRectangle.intersect(featureRect, tileRect) ===
          Intersect.OUTSIDE
        ) {
          continue;
        }
        extentFactor = canvas.width / size;
        coordinates = overzoomGeometry(
          feature.loadGeometry(),
          nativeTile,
          size,
          requestedTile
        );
      } else {
        coordinates = feature.loadGeometry();
      }

      // fillColor = fillColor || rgba(context.fillStyle)
      // strokeColor = strokeColor || rgba(context.strokeStyle)


      // render as pixel
      if (radius <= 1) {
        // fillRect 렌더링
        for (var i2 = 0; i2 < coordinates.length; i2++) {
          pos = coordinates[i2][0];
          context.fillStyle
            ? context.fillRect(pos.x * extentFactor - radius, pos.y * extentFactor - radius, radius * 2, radius * 2)
            : context.strokeRect(pos.x * extentFactor -radius, pos.y * extentFactor - radius, radius * 2, radius * 2)
        }
      } else {
        // arc 렌더링
        for (var i2 = 0; i2 < coordinates.length; i2++) {
          context.beginPath()
          pos = coordinates[i2][0];
          context.arc(pos.x * extentFactor, pos.y * extentFactor, radius, 0, Math.PI * 2, false)
          context.strokeStyle && context.stroke();
          context.fillStyle && context.fill();
        }
      }

      // buffer rendering: 그렇게 빠르지 않다.
      // buffer = buffer || context.getImageData(0, 0, canvas.width, canvas.height);
      // // Points
      // for (var i2 = 0; i2 < coordinates.length; i2++) {
      //   pos = coordinates[i2][0];
      //   const index = (pos.x * extentFactor + pos.y * extentFactor * canvas.width) * 4 // << 2
      //   buffer.data[index + 0] = fillColor[0]
      //   buffer.data[index + 1] = fillColor[1]
      //   buffer.data[index + 2] = fillColor[2]
      //   buffer.data[index + 3] = fillColor[3]
      // }

    } else {
      Console.log(
        "Unexpected geometry type: " +
          feature.type +
          " in region map on tile " +
          [requestedTile.level, requestedTile.x, requestedTile.y].join("/")
      );
    }
  }

  buffer && context.putImageData(buffer, 0, 0)

  if (rows.length) {
    const prev = this._data.rows.length
    this._data.rows = _.concat(this._data.rows, rows)
    this._styleCache.table = new KeplerTable({data: this._data, metadata: {}})

    // Console.log(`[provider._drawTile]: ${this._data.rows.length - prev}/${this._data.rows.length}`)
  }

  return canvas;
};

function isExteriorRing(ring) {
  // Normally an exterior ring would be clockwise but because these coordinates are in "canvas space" the ys are inverted
  // hence check for counter-clockwise ring
  const windingOrder = computeRingWindingOrder(ring);
  return windingOrder === WindingOrder.COUNTER_CLOCKWISE;
}

// Adapted from npm package "point-in-polygon" by James Halliday
// Licence included in LICENSE.md
function inside(point, vs) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

  var x = point.x,
    y = point.y;

  var inside = false;
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i].x,
      yi = vs[i].y;
    var xj = vs[j].x,
      yj = vs[j].y;

    var intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function sqr(n) {
  return n * n
}

function distance2point(v, w) {
  const ret = Math.sqrt(sqr(v.x - w.x) + sqr(v.y - w.y))
  // Console.log('[distance2point]', ret)
  return ret
}

function square2point(v, w) {
  const ret = sqr(v.x - w.x) + sqr(v.y - w.y)
  // Console.log('[square2point]', ret)
  return ret
}

function distance2segment(p, v, w) {
  var l2 = square2point(v, w);
  if (l2 === 0) return square2point(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const ret = Math.sqrt(square2point(p, {x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }));
  // Console.log('[distance2segment]', {l2, t, ret})
  return ret
}

// According to the Mapbox Vector Tile specifications, a polygon consists of one exterior ring followed by 0 or more interior rings. Therefore:
// for each ring:
//   if point in ring:
//     for each interior ring (following the exterior ring):
//       check point in interior ring
//     if point not in any interior rings, feature is clicked
function isFeatureClicked(geomType, coordinates, point) {
  var extentFactor = 256 / 4096 // canvas.width / layer.extent; // Vector tile works with extent [0, 4095], but canvas is only [0,255]
  const TOLERANCE = 2.5 // / extentFactor
  // parts
  for (var i = 0; i < coordinates.length; i++) {
    // polygon rings
    if (geomType === POLYGON_FEATURE) {
      if (inside(point, coordinates[i])) {
        // Point is in an exterior ring
        // Check whether point is in any interior rings
        var inInteriorRing = false;
        while (i + 1 < coordinates.length && !isExteriorRing(coordinates[i + 1])) {
          i++;
          if (!inInteriorRing && inside(point, coordinates[i])) {
            inInteriorRing = true;
            // Don't break. Still need to iterate over the rest of the interior rings but don't do point-in-polygon tests on those
          }
        }
        // Point is in exterior ring, but not in any interior ring. Therefore point is in the feature region
        if (!inInteriorRing) {
          return true;
        }
      }
    } else if (geomType === POLYLINE_FEATURE) {
      // segments
      for(var j = 0; j < coordinates[i].length - 1; j++) {
        if (distance2segment(point, coordinates[i][j], coordinates[i][j + 1]) <= TOLERANCE) {
          return true
        }
      }
    } else if (geomType === POINT_FEATURE) {
      // points
      for(var j = 0; j < coordinates[i].length; j++) {
        if (distance2point(point, coordinates[i][j]) <= TOLERANCE) {
          return true
        }
      }
    }
  }
  return false;
}

GeowaveVectorTileImageryProvider.prototype.pickFeatures = function(
  x,
  y,
  level,
  longitude,
  latitude
) {
  var nativeTile;
  var levelDelta;
  var requestedTile = {
    x: x,
    y: y,
    level: level
  };
  // Check whether to use a native tile or overzoom the largest native tile
  if (level > this._maximumNativeLevel) {
    // Determine which native tile to use
    levelDelta = level - this._maximumNativeLevel;
    nativeTile = {
      x: x >> levelDelta,
      y: y >> levelDelta,
      level: this._maximumNativeLevel
    };
  } else {
    nativeTile = {
      x: x,
      y: y,
      level: level
    };
  }

  var that = this;
  var url = this._buildImageUrl(nativeTile.x, nativeTile.y, nativeTile.level);

  return loadArrayBuffer(url).then(function(data) {
    var layer = new VectorTile(new Protobuf(data)).layers[that._layerName];

    if (!defined(layer)) {
      return []; // return empty list of features for empty tile
    }

    var vt_range = [0, (layer.extent >> levelDelta) - 1];

    var boundRect = that._tilingScheme.tileXYToNativeRectangle(x, y, level);
    var x_range = [boundRect.west, boundRect.east];
    var y_range = [boundRect.north, boundRect.south];

    var map = function(pos, in_x_range, in_y_range, out_x_range, out_y_range) {
      var offset = new Cartesian2();
      Cartesian2.subtract(
        pos,
        new Cartesian2(in_x_range[0], in_y_range[0]),
        offset
      ); // Offset of point from bottom left corner of bounding box
      var scale = new Cartesian2(
        (out_x_range[1] - out_x_range[0]) / (in_x_range[1] - in_x_range[0]),
        (out_y_range[1] - out_y_range[0]) / (in_y_range[1] - in_y_range[0])
      );
      return Cartesian2.add(
        Cartesian2.multiplyComponents(offset, scale, new Cartesian2()),
        new Cartesian2(out_x_range[0], out_y_range[0]),
        new Cartesian2()
      );
    };

    var pos = Cartesian2.fromCartesian3(
      that._tilingScheme.projection.project(
        new Cartographic(longitude, latitude)
      )
    );
    pos = map(pos, x_range, y_range, vt_range, vt_range);
    var point = new Point(pos.x, pos.y);

    var features = [];
    for (var i = 0; i < layer.length; i++) {
      var feature = layer.feature(i);
      if (isFeatureClicked(
          feature.type,
          overzoomGeometry(
            feature.loadGeometry(),
            nativeTile,
            layer.extent >> levelDelta,
            requestedTile
          ),
          point
        )) {
        var featureInfo = that._featureInfoFunc(feature);
        if (defined(featureInfo)) {
          features.push(featureInfo);
        }
      }
    }

    return features;
  });
};

GeowaveVectorTileImageryProvider.prototype.createHighlightImageryProvider = function(
  regionUniqueID
) {
  var that = this;
  var styleFunc = function(FID) {
    if (regionUniqueID === FID) {
      // No fill, but same style border as the regions, just thicker
      var regionStyling = that._styleFunc(FID);
      if (defined(regionStyling)) {
        regionStyling.fillStyle = "rgba(0, 0, 0, 0)";
        regionStyling.lineJoin = "round";
        regionStyling.lineWidth = Math.floor(
          1.5 * defaultValue(regionStyling.lineWidth, 1) + 1
        );
        return regionStyling;
      }
    }
    return undefined;
  };
  var imageryProvider = new GeowaveVectorTileImageryProvider({
    url: this._uriTemplate.expression,
    layerName: this._layerName,
    subdomains: this._subdomains,
    rectangle: this._rectangle,
    minimumZoom: this._minimumLevel,
    maximumNativeZoom: this._maximumNativeLevel,
    maximumZoom: this._maximumLevel,
    uniqueIdProp: this._uniqueIdProp,
    styleFunc: styleFunc,
    data: this._data,
  });
  imageryProvider.pickFeatures = function() {
    return undefined;
  }; // Turn off feature picking
  return imageryProvider;
};

module.exports = GeowaveVectorTileImageryProvider;
