const Resource = require("terriajs-cesium/Source/Core/Resource").default;
const when = require("terriajs-cesium/Source/ThirdParty/when").default;

function loadTwkb(url, token, urlAttachment, accuVersion) {
  var resource = new Resource({url});
  // mode: 'no-cors' // 'cors' by default
  // Accu 3.0의 데이터 방식이 바뀜 2.0 과 3.0 둘다 사용하기 위해서 일단 작성
  if(accuVersion === 3) {
    const urls = url.split('=')
    resource.queryParameters.url+= `=${urls[urls.length-1]}`
  }
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
    : when(JSON.stringify(require("../../wwwroot/data/"+url.split('/')[4])))
}

module.exports = loadTwkb;
