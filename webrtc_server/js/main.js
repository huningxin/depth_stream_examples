'use strict';

var container = document.getElementById("remote3DSence");
var container_width = 640, container_height = 480;

var isChannelReady;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var localDepthStream, remoteDepthStream;

var nearClipping = 150, farClipping = 3000;
var pointSize = 2;
var zOffset = 500;

var stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.bottom = '0px';
stats.domElement.style.left = '0px';
document.body.appendChild( stats.domElement );

var tryRgbd = false;
try {
  var re = /Chrome\/\d*\.\d*\.\d*\.\d*/;
  if (navigator.userAgent.match(re)[0].split('/')[1].split('.')[0] > 33)
    tryRgbd = true;
} catch (e) {
}

var pc_config = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};

var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

/////////////////////////////////////////////

var room = location.pathname.substring(1);
if (room === '') {
//  room = prompt('Enter room name:');
  room = 'foo';
} else {
  //
}

var socket = io.connect();

if (room !== '') {
  console.log('Create or join room', room);
  socket.emit('create or join', room);
}

socket.on('created', function (room){
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room){
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function (room){
  console.log('This peer has joined room ' + room);
  isChannelReady = true;
});

socket.on('log', function (array){
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message){
	console.log('Client sending message: ', message);
  // if (typeof message === 'object') {
  //   message = JSON.stringify(message);
  // }
  socket.emit('message', message);
}

socket.on('message', function (message){
  console.log('Client received message:', message);
  if (message === 'got user media') {
  	maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var localDepthVideo = document.querySelector('#localDepthVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var remoteDepthVideo = document.querySelector('#remoteDepthVideo');

var no_depth = false;

function handleRGBStream(stream) {
  console.log('Adding local stream.');
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;

  if (isInitiator && no_depth) {
    sendMessage('got user media');
    maybeStart();
  }
  // then try depth
  if (!no_depth) {
    navigator.getUserMedia(depth_constraints, handleDepthStream, function(error) {
      console.log('cannot obtain depth stream: ', error);
    });
  }
}

function handleDepthStream(stream){
  console.log("Received local depth stream");
  localDepthVideo.src = window.URL.createObjectURL(stream);
  localDepthStream = stream;
  sendMessage('got user media');
  if (isInitiator)
    maybeStart();
}

function handleUserMediaError(error){
  console.log('navigator.getUserMedia error: ', error);
}

var rgb_constraints = {video: true};
var rgbd_constraints = {video:{'mandatory': {'depth': 'rgbd'}}};
var depth_constraints = {video: {'mandatory': {'depth': true}}};
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// first try rgbd
if (tryRgbd) {
  navigator.getUserMedia(rgbd_constraints, handleRGBStream, function(error) {
    console.log('cannot fetch RGBD stream: ', error);
    console.log('try normla RGB stream');
    no_depth = true;
    navigator.getUserMedia(rgb_constraints, handleRGBStream, handleUserMediaError);
  });
} else {
  no_depth = false;
  navigator.getUserMedia(rgb_constraints, handleRGBStream, handleUserMediaError);
}

if (location.hostname != "localhost") {
  requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
}

function maybeStart() {

  if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {
    if (!no_depth && typeof localDepthStream == 'undefined')
      return;
    createPeerConnection();
    pc.addStream(localStream);
    console.log('add RGB stream');
    if (typeof localDepthStream != 'undefined') {
      pc.addStream(localDepthStream);
      console.log('add Depth stream');
    }
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function(e){
	sendMessage('bye');
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new webkitRTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }
}

function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate});
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
  // The assumption is RGB stream is the first one.
  if (typeof remoteStream == 'undefined') {
    console.log('Remote RGB stream added.');
    remoteVideo.src = window.URL.createObjectURL(event.stream);
    remoteStream = event.stream;
  } else if (typeof remoteDepthStream == 'undefined') {
    console.log('Remote depth stream added.');
    remoteDepthStream = event.stream;
    remoteDepthVideo.src = URL.createObjectURL(event.stream);
    startRendering(container, remoteDepthVideo, remoteVideo);
  }
}

function handleCreateOfferError(event){
  console.log('createOffer() error: ', e);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message' , sessionDescription);
  sendMessage(sessionDescription);
}

function requestTurn(turn_url) {
  var turnExists = false;
  for (var i in pc_config.iceServers) {
    if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turn_url);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
      	console.log('Got TURN server: ', turnServer);
        pc_config.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turn_url, true);
    xhr.send();
  }
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
//  console.log('Session terminated.');
  // stop();
  // isInitiator = false;
}

function stop() {
  isStarted = false;
  // isAudioMuted = false;
  // isVideoMuted = false;
  pc.close();
  pc = null;
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

function startRendering(container, depthVideo, rgbVideo) {
  var camera = new THREE.PerspectiveCamera( 50, container_width / container_height, 1, 10000 );
  camera.position.set( 0, 0, 500 );

  var scene = new THREE.Scene();
  var center = new THREE.Vector3();
  center.z = - 1000;

  var depth_canvas = document.createElement( 'canvas');
  depth_canvas.width = 320;
  depth_canvas.height = 240;
  var depth_context = depth_canvas.getContext('2d');
  var color_canvas = document.createElement( 'canvas');
  color_canvas.width = 320;
  color_canvas.height = 240;
  var color_context = color_canvas.getContext('2d');
  var depth_texture;
  var color_texture;
  var geometry;
  var material;

  function VideoReady() {
    depth_texture = new THREE.Texture( depth_canvas );
    color_texture = new THREE.Texture( color_canvas );

    var width = 320, height = 240;

    geometry = new THREE.Geometry();

    for ( var i = 0, l = width * height; i < l; i ++ ) {

        var vertex = new THREE.Vector3();
        vertex.x = ( i % width );
        vertex.y = Math.floor( i / width );

        geometry.vertices.push( vertex );

    }

    material = new THREE.ShaderMaterial( {

        uniforms: {

            "map": { type: "t", value: depth_texture },
            "rgbMap": {type: "t", value: color_texture },
            "width": { type: "f", value: width },
            "height": { type: "f", value: height },
            "nearClipping": { type: "f", value: nearClipping },
            "farClipping": { type: "f", value: farClipping },
            "depthEncoding": { type: "f", value: 0},
            "pointSize": { type: "f", value: pointSize },
            "zOffset": { type: "f", value: zOffset }

        },
        vertexShader: document.getElementById( 'vs' ).textContent,
        fragmentShader: document.getElementById( 'fs' ).textContent,
        depthTest: false, depthWrite: false,
        transparent: true

    } );

    var mesh = new THREE.ParticleSystem( geometry, material );
    mesh.position.x = 0;
    mesh.position.y = 0;
    scene.add( mesh );

    var gui = new dat.GUI({autoPlace: false});
    container.appendChild(gui.domElement);
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "0px";
    gui.domElement.style.right = "5px";
    gui.add( material.uniforms.nearClipping, 'value', 1, 10000, 1.0 ).name( 'nearClipping' );
    gui.add( material.uniforms.farClipping, 'value', 1, 10000, 1.0 ).name( 'farClipping' );
    gui.add( material.uniforms.pointSize, 'value', 1, 10, 1.0 ).name( 'pointSize' );
    gui.add( material.uniforms.zOffset, 'value', 0, 4000, 1.0 ).name( 'zOffset' );
    gui.add( material.uniforms.depthEncoding, 'value', { Grayscale: 0, Adaptive: 1, Raw: 2 } ).name('Depth Encoding');
    gui.close();

    var intervalId = setInterval(drawVideo, 1000 / 30 );
    animate();

  }

  var renderer = new THREE.WebGLRenderer();
  renderer.setSize( container_width, container_height );
  container.appendChild( renderer.domElement );

  var mouse = new THREE.Vector3( 0, 0, 1 );

  window.addEventListener( 'mousemove', onDocumentMouseMove, false );

  requestAnimationFrame(VideoReady);

  function drawVideo() {
    if ( depthVideo.readyState === depthVideo.HAVE_ENOUGH_DATA ) {
        depth_context.drawImage(depthVideo, 0, 0, depth_canvas.width, depth_canvas.height);
        depth_texture.needsUpdate = true;
    }
    if ( rgbVideo.readyState === rgbVideo.HAVE_ENOUGH_DATA ) {
        color_context.drawImage(rgbVideo, 0, 0, color_canvas.width, color_canvas.height);
        color_texture.needsUpdate = true;
    }
  }

  function onDocumentMouseMove( event ) {
    mouse.x = ( event.clientX - window.innerWidth / 2 ) * 8;
    mouse.y = ( event.clientY - window.innerHeight / 2 ) * 8;
  }

  function animate() {
    var animationId = requestAnimationFrame( animate );

    render();
    stats.update();
  }

  function render() {
    camera.position.x += ( mouse.x - camera.position.x ) * 0.05;
    camera.position.y += ( - mouse.y - camera.position.y ) * 0.05;
    camera.lookAt( center );

    renderer.render( scene, camera );
  }
}