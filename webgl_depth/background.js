// Copyright (c) 2013 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function createWindow(url) {
  console.log('loading ' + url);
  chrome.app.window.create(url, {
    width: 640,
    height: 480,
  });
}

function onLaunched(launchData) {
  createWindow('index.html');
}

chrome.app.runtime.onLaunched.addListener(onLaunched);
