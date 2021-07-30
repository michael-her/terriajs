const Resource = require("terriajs-cesium/Source/Core/Resource").default;
const when = require("terriajs-cesium/Source/ThirdParty/when").default;

function loadTwkb(url, token, urlAttachment) {
  var resource = new Resource({url});
  // mode: 'no-cors' // 'cors' by default
  const options = {
    mode: 'cors',
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Authorization': token,
    }
  }

  return urlAttachment
    ? resource.post(urlAttachment, options)
    : when(JSON.stringify(require(url.includes('11') ?"../../wwwroot/data/preview_response_11.json" : "../../wwwroot/data/preview_response_12.json")))
}

module.exports = loadTwkb;
