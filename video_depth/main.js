var rgb_video = document.querySelector('#rgb_video');
var aligned_depth_video = document.querySelector('#aligned_depth_video');
var depth_video = document.querySelector('#depth_video');

var start_rgb_btn = document.querySelector('#start_rgb_btn');
var stop_rgb_btn = document.querySelector('#stop_rgb_btn');
var start_aligned_depth_btn = document.querySelector('#start_aligned_depth_btn');
var stop_aligned_depth_btn = document.querySelector('#stop_aligned_depth_btn');
var start_depth_btn = document.querySelector('#start_depth_btn');
var stop_depth_btn = document.querySelector('#stop_depth_btn');

var rgb_capture_state = 'IDLE';
var aligned_depth_capture_state = 'IDLE';
var depth_capture_state = 'IDLE';

var rgb_stream;
var aligned_depth_stream;
var depth_stream;

function startRGBMediaStream() {
  if (rgb_capture_state != 'IDLE')
    return;

  navigator.webkitGetUserMedia({
    audio: false,
    video: true
  }, function(stream) {
    rgb_stream = stream;
    var vendorURL = window.URL || window.webkitURL;
    rgb_video.src = vendorURL ? vendorURL.createObjectURL(rgb_stream) : rgb_stream;
    rgb_video.play();
    rgb_capture_state = 'RUNNING';
  }, function(e) {
    console.log(e);
  });
}

function stopRGBMediaStream() {
  if (rgb_capture_state != 'RUNNING')
    return;
  rgb_stream.stop();
  rgb_video.pause();
  rgb_video.src = '';
  rgb_capture_state = 'IDLE';
}

function startAlignedDepthMediaStream() {
  if (aligned_depth_capture_state != 'IDLE')
    return;

  navigator.webkitGetUserMedia({
    audio: false,
    video: {'mandatory': {'depth': "aligned"}}
  }, function(stream) {
    aligned_depth_stream = stream;
    var vendorURL = window.URL || window.webkitURL;
    aligned_depth_video.src = vendorURL ? vendorURL.createObjectURL(aligned_depth_stream) : aligned_depth_stream;
    aligned_depth_video.play();
    aligned_depth_capture_state = 'RUNNING';
  }, function(e) {
    console.log(e);
  });
}

function stopAlignedDepthMediaStream() {
  if (aligned_depth_capture_state != 'RUNNING')
    return;
  aligned_depth_stream.stop();
  aligned_depth_video.pause();
  aligned_depth_video.src = '';
  aligned_depth_capture_state = 'IDLE';
}

function startDepthMediaStream() {
  if (depth_capture_state != 'IDLE')
    return;

  navigator.webkitGetUserMedia({
    audio: false,
    video: {'mandatory': {'depth': true}}
  }, function(stream) {
    depth_stream = stream;
    var vendorURL = window.URL || window.webkitURL;
    depth_video.src = vendorURL ? vendorURL.createObjectURL(depth_stream) : depth_stream;
    depth_video.play();
    depth_capture_state = 'RUNNING';
  }, function(e) {
    console.log(e);
  });
}

function stopDepthMediaStream() {
  if (depth_capture_state != 'RUNNING')
    return;
  depth_stream.stop();
  depth_video.pause();
  depth_video.src = '';
  depth_capture_state = 'IDLE';
}

start_rgb_btn.addEventListener('click', startRGBMediaStream);
stop_rgb_btn.addEventListener('click', stopRGBMediaStream);
start_aligned_depth_btn.addEventListener('click', startAlignedDepthMediaStream);
stop_aligned_depth_btn.addEventListener('click', stopAlignedDepthMediaStream);
start_depth_btn.addEventListener('click', startDepthMediaStream);
stop_depth_btn.addEventListener('click', stopDepthMediaStream);
