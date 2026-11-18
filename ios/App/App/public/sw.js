/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "index.html",
    "revision": "384292044c4049e01d6c51f2e6ec8f53"
  }, {
    "url": "assets/web-IQttoI_E.js",
    "revision": null
  }, {
    "url": "assets/web-DEMgNtsM.js",
    "revision": null
  }, {
    "url": "assets/purify.es-7fJ1DZ6H.js",
    "revision": null
  }, {
    "url": "assets/index.es-B5jaCIct.js",
    "revision": null
  }, {
    "url": "assets/index-U02BYZs8.css",
    "revision": null
  }, {
    "url": "assets/index-Blaj_Uf-.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-Zk7qrxQD.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "c02256c6fc5fe72f0c1b0b482a49e959"
  }, {
    "url": "icon.svg",
    "revision": "53da67d93b550ab0b900c71d4f29f0ea"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e1fc400dd1f3251004b5fb1570dd8d87"
  }, {
    "url": "pwa-512x512.png",
    "revision": "9a7a45f4808acb3a8586d6937d734d6a"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "9a7a45f4808acb3a8586d6937d734d6a"
  }, {
    "url": "manifest.webmanifest",
    "revision": "22211d43456fe4cc158dc5f6516591de"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
