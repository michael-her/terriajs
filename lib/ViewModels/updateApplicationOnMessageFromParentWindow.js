"use strict";

/*global require*/
var defined = require("terriajs-cesium/Source/Core/defined").default;
var raiseErrorToUser = require("../Models/raiseErrorToUser");
import Console from 'global/console'

const MAPLOADEDCHECK = 'mapLoadedCheck'
const MAPDATACATALOG = 'mapDataCatalog'

var updateApplicationOnMessageFromParentWindow = function(terria, window) {
  var allowOrigin;

  window.addEventListener(
    "message",
    function(event) {
      var origin = event.origin;
      if (!defined(origin) && defined(event.originalEvent)) {
        // For Chrome, the origin property is in the event.originalEvent object.
        origin = event.originalEvent.origin;
      }

      if (
        (!defined(allowOrigin) || origin !== allowOrigin) && // allowed origin in url hash parameter
        event.source !== window.parent && // iframe parent
        event.source !== window.opener
      ) {
        // caller of window.open
        return;
      }

      // receive allowOrigin
      if (
        (event.source === window.opener || event.source === window.parent) &&
        event.data.allowOrigin
      ) {
        allowOrigin = event.data.allowOrigin;
        delete event.data.allowOrigin;
      }

      // Ignore react devtools
      if (/^(react-devtools|@devtools-page)/gi.test(event.data.source)) {
        return;
      }

      Console.log('[message]', {source: event.data.source, data: event.data})
      // Console.log('[event]',event, window)
      // event.source.postMessage("hi there yourself!  the secret response ",
      //   event.origin);
      // Added communication method between AccuInsight and TerriaMap
      if(defined(event.data.message)){
        const { message } = event.data
        Console.log('[event.data.message]', message, event.source)
        if(message===MAPLOADEDCHECK) {
          event.source.postMessage(JSON.stringify(event.data), event.origin);
        } else if(message===MAPDATACATALOG) {
          terria.updateFromStartData(event.data).otherwise(function(e) {
            raiseErrorToUser(terria, e);
          });
        }
      }
    },
    false
  );

  if (window.parent !== window) {
    window.parent.postMessage("ready", "*");
  }

  if (window.opener) {
    window.opener.postMessage("ready", "*");
  }
};

module.exports = updateApplicationOnMessageFromParentWindow;
