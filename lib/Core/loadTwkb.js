const Resource = require("terriajs-cesium/Source/Core/Resource").default;

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
    : require(url) // resource.fetch(options)
}

module.exports = loadTwkb;
