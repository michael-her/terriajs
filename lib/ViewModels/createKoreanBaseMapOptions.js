"use strict";

/*global require*/
var OpenStreetMapCatalogItem = require("../Models/OpenStreetMapCatalogItem");
var BaseMapViewModel = require("./BaseMapViewModel");

var createAustraliaBaseMapOptions = function(terria) {
  var result = [];

  const naverStreet = new OpenStreetMapCatalogItem(terria);
  naverStreet.url = "https://map.pstatic.net/nrb/styles/basic/1616668286";
  naverStreet.opacity = 1.0;
  naverStreet.isRequiredForRendering = true;
  naverStreet.name = "네이버 지도";
  naverStreet.allowFeaturePicking = false;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/naver-street_kr.png"),
      catalogItem: naverStreet,
      contrastColor: "#000000"
    })
  );

  const naverStatellite = new OpenStreetMapCatalogItem(terria)
  naverStatellite.url = "https://map.pstatic.net/nrb/styles/satellite/1616668286"
  naverStatellite.opacity = 1.0;
  naverStatellite.isRequiredForRendering = true;
  naverStatellite.name = "네이버 위성";
  naverStatellite.allowFeaturePicking = false;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/naver-satellite_kr.png"),
      catalogItem: naverStatellite,
      contrastColor: "#000000"
    })
  );

  const vworldStreet = new OpenStreetMapCatalogItem(terria)
  vworldStreet.url = "https://xdworld.vworld.kr/2d/Base/service"
  vworldStreet.opacity = 1.0;
  vworldStreet.isRequiredForRendering = true;
  vworldStreet.name = "브이월드 지도";
  vworldStreet.allowFeaturePicking = false;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/vworld-street_kr.png"),
      catalogItem: vworldStreet,
      contrastColor: "#000000"
    })
  );

  const vworldSatellite = new OpenStreetMapCatalogItem(terria)
  vworldSatellite.url = "https://xdworld.vworld.kr/2d/Satellite/service"
  vworldSatellite.fileExtension = "jpeg"
  vworldSatellite.opacity = 1.0;
  vworldSatellite.isRequiredForRendering = true;
  vworldSatellite.name = "브이월드 위성";
  vworldSatellite.allowFeaturePicking = false;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/vworld-satellite_kr.png"),
      catalogItem: vworldSatellite,
      contrastColor: "#000000"
    })
  );

  return result;
};

module.exports = createAustraliaBaseMapOptions;
