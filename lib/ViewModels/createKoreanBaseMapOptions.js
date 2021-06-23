"use strict";

/*global require*/
var OpenStreetMapCatalogItem = require("../Models/OpenStreetMapCatalogItem");
var BaseMapViewModel = require("./BaseMapViewModel");

var createKoreanBaseMapOptions = function(terria) {
  var result = [];

  const vworldStreet = new OpenStreetMapCatalogItem(terria)
  vworldStreet.url = "https://xdworld.vworld.kr/2d/Base/service"
  vworldStreet.opacity = 1.0;
  vworldStreet.isRequiredForRendering = true;
  vworldStreet.name = "브이월드 지도";
  vworldStreet.allowFeaturePicking = false;
  vworldStreet.maximumLevel = 19

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
  vworldSatellite.maximumLevel = 19

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/vworld-satellite_kr.png"),
      catalogItem: vworldSatellite,
      contrastColor: "#000000"
    })
  );

  const naverStreet = new OpenStreetMapCatalogItem(terria);
  naverStreet.url = "https://map.pstatic.net/nrb/styles/basic/1623919233";
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

  const naverSatellite = new OpenStreetMapCatalogItem(terria)
  naverSatellite.url = "https://map.pstatic.net/nrb/styles/satellite/1623919233"
  naverSatellite.opacity = 1.0;
  naverSatellite.isRequiredForRendering = true;
  naverSatellite.name = "네이버 위성";
  naverSatellite.allowFeaturePicking = false;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/naver-satellite_kr.png"),
      catalogItem: naverSatellite,
      contrastColor: "#000000"
    })
  );

  return result;
};

module.exports = createKoreanBaseMapOptions;
