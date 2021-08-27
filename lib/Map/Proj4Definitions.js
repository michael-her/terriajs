"use strict";

/**
 * Defines the built-in proj4 projection definitions known to TerriaJS.  Additional projections can be added
 * to this object literal.
 * @alias Proj4Definitions
 * @type {Object}
 */
var Proj4Definitions = {
  // Built-in proj4 entries
  "EPSG:4326": "EPSG:4326",
  WGS84: "WGS84",
  "EPSG:4269": "EPSG:4269",
  "EPSG:3857": "EPSG:3857",
  "EPSG:3785": "EPSG:3785",
  GOOGLE: "GOOGLE",
  "EPSG:900913": "EPSG:900913",
  "EPSG:102113": "EPSG:102113",

  // Custom TerriaJS entries
  "EPSG:3006":
    "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:4283": "+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs",
  "EPSG:3577":
    "+proj=aea +lat_1=-18 +lat_2=-36 +lat_0=0 +lon_0=132 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:3107":
    "+proj=lcc +lat_1=-28 +lat_2=-36 +lat_0=-32 +lon_0=135 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:3112":
    "+proj=lcc +lat_1=-18 +lat_2=-36 +lat_0=0 +lon_0=134 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28349":
    "+proj=utm +zone=49 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28350":
    "+proj=utm +zone=50 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28351":
    "+proj=utm +zone=51 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28352":
    "+proj=utm +zone=52 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28353":
    "+proj=utm +zone=53 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28354":
    "+proj=utm +zone=54 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28355":
    "+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28356":
    "+proj=utm +zone=56 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28357":
    "+proj=utm +zone=57 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28358":
    "+proj=utm +zone=58 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:20248": "+proj=utm +zone=48 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20249": "+proj=utm +zone=49 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20250": "+proj=utm +zone=50 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20251": "+proj=utm +zone=51 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20252": "+proj=utm +zone=52 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20253": "+proj=utm +zone=53 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20254": "+proj=utm +zone=54 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20255": "+proj=utm +zone=55 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20256": "+proj=utm +zone=56 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20257": "+proj=utm +zone=57 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:20258": "+proj=utm +zone=58 +south +ellps=aust_SA +units=m +no_defs",
  "EPSG:102100": "EPSG:3857",
  "EPSG:27700":
    "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs",

  // Korea Epsg add
  "EPSG:5179": "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs",
  "EPSG:5186": "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs",
  "EPSG:5174": "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",

};

module.exports = Proj4Definitions;
