var container;
            var info;

            var scene, camera, light, renderer, controls;
            var geometry, cube, mesh, material;
            var mouse, center;
            var stats;
            var intervalId, animationId;

            var live = false;
            var button = document.getElementById("depth_capture_button");

            var depthVideo, depthTexture, depthCanvas, depthContext;
            var rgbVideo = null, rgbTexture = null, rgbCanvas = null, rgbContext = null;

            var gui;

            var showBackground = false;

            var showDepthVideo = true;
            var depthStream = null;

            var enableRgbTexture = false;
            var rgbStream = null;

            var kLiveDepthStream = "Depth Stream from Live Capture";
            var kReplayDepthStream = "Depth Stream from depth_video.webm";

            if ( Detector.webgl ) {
                start();
            } else {
                document.body.appendChild( Detector.getWebGLErrorMessage() );
            }

            function start() {
                navigator.webkitGetUserMedia({
                    audio: false,
                    video: { "mandatory": { "depth": true}},
                },
                function(stream) {
                    depthStream = stream;
                    if (enableRgbTexture) {
                        navigator.webkitGetUserMedia({
                            audio: false,
                            video: { "mandatory": { "depth": "rgbd"}},
                            },
                            function(stream) {
                                rgbStream = stream;
                                init(window.URL.createObjectURL(depthStream),
                                     window.URL.createObjectURL(rgbStream), 
                                     kLiveDepthStream);
                            },
                            function(e) {
                            console.log('fails to obtain rgbd stream ' + e);
                        });
                    } else {
                        init(window.URL.createObjectURL(depthStream),
                             null, kLiveDepthStream);
                    }
                },
                function(e) {
                    console.log('fails to obtain depth stream ' + e);
                });
            }

            function reset() {
                depthVideo.pause();
                if (depthStream) {
                    depthStream = null;
                }
                clearInterval(intervalId);
                cancelAnimationFrame(animationId);
                document.body.removeChild(container);
                document.body.removeChild(info);
                document.body.removeChild(depthVideo);
                try {
                    document.body.removeChild(gui.domElement);
                } catch(e) {
                    console.log(e);
                }


                if (rgbStream) {
                    rgbVideo.pause();
                    rgbStream = null;
                    document.body.removeChild(rgbVideo);
                }
            }

            function drawVideo() {
                if ( depthVideo.readyState === depthVideo.HAVE_ENOUGH_DATA ) {
                    depthContext.drawImage(depthVideo, 0, 0, depthCanvas.width, depthCanvas.height);
                    depthTexture.needsUpdate = true;
                }

                if ( enableRgbTexture && rgbVideo && rgbVideo.readyState === rgbVideo.HAVE_ENOUGH_DATA ) {
                    rgbContext.drawImage(rgbVideo, 0, 0, rgbCanvas.width, rgbCanvas.height);
                    rgbTexture.needsUpdate = true;
                }
            }


            function init(depthStream, rgbStream, description) {
                container = document.createElement( 'div' );
                document.body.appendChild( container );

                info = document.createElement( 'div' );
                info.id = 'info';
                info.innerHTML = description;
                document.body.appendChild( info );

                stats = new Stats();
                stats.domElement.style.position = 'absolute';
                stats.domElement.style.bottom = '0px';
                stats.domElement.style.left = '0px';
                container.appendChild( stats.domElement );

                camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10000 );
                camera.position.set( 0, 0, 500 );

                controls = new THREE.OrbitControls( camera );
                controls.target = new THREE.Vector3( 0, 0, -1000 );
                controls.update();
                controls.dollyIn(1.5);
                controls.update();

                scene = new THREE.Scene();
                center = new THREE.Vector3();
                center.z = - 1000;


                depthVideo = document.createElement( 'video' );
                depthCanvas = document.createElement( 'canvas');
                depthCanvas.width = 320;
                depthCanvas.height = 240;
                depthContext = depthCanvas.getContext('2d');

                if (enableRgbTexture) {
                    rgbVideo = document.createElement( 'video' );
                    rgbCanvas = document.createElement( 'canvas');
                    rgbCanvas.width = 320;
                    rgbCanvas.height = 240;
                    rgbContext = rgbCanvas.getContext('2d');
                }

                function VideoReady () {
                    depthTexture = new THREE.Texture( depthCanvas );
                    if (enableRgbTexture)
                        rgbTexture = new THREE.Texture( rgbCanvas );

                    var width = 320, height = 240;
                    var nearClipping = 150, farClipping = 3000;
                    var depthOfField = 1000;

                    geometry = new THREE.Geometry();

                    for ( var i = 0, l = width * height; i < l; i ++ ) {

                        var vertex = new THREE.Vector3();
                        vertex.x = ( i % width );
                        vertex.y = Math.floor( i / width );

                        geometry.vertices.push( vertex );

                    }

                    material = new THREE.ShaderMaterial( {

                        uniforms: {

                            "map": { type: "t", value: depthTexture },
                            "rgbMap": { type: "t", value: rgbTexture },
                            "width": { type: "f", value: width },
                            "height": { type: "f", value: height },
                            "nearClipping": { type: "f", value: nearClipping },
                            "farClipping": { type: "f", value: farClipping },
                            "depthOfField": { type: "f", value: depthOfField },
                            "pointSize": { type: "f", value: 4 },
                            "zOffset": { type: "f", value: 0 },
                            "depthEncoding": { type: "f", value: 0},
                            "enableRgbTexture": { type: "f", value: enableRgbTexture ? 1.0 : 0.0},
                            "showBackground": {type: "f", value: showBackground ? 1.0 : 0.0}

                        },
                        vertexShader: document.getElementById( 'vs' ).textContent,
                        fragmentShader: document.getElementById( 'fs' ).textContent,
                        depthTest: false, depthWrite: false,
                        transparent: true

                    });

                    mesh = new THREE.ParticleSystem( geometry, material );
                    mesh.position.x = 0;
                    mesh.position.y = 0;
                    scene.add( mesh );

                    try {
                        gui = new dat.GUI({autoPlace: false});
                        document.body.appendChild(gui.domElement);
                        gui.domElement.style.position = "absolute";
                        gui.domElement.style.top = "0px";
                        gui.domElement.style.right = "5px";
                        gui.add( material.uniforms.nearClipping, 'value', 1, 10000, 1.0 ).name( 'nearClipping' );
                        gui.add( material.uniforms.farClipping, 'value', 1, 10000, 1.0 ).name( 'farClipping' );
                        gui.add( material.uniforms.depthOfField, 'value', 1, 10000, 1.0 ).name( 'depthOfField' );
                        gui.add( material.uniforms.pointSize, 'value', 1, 10, 1.0 ).name( 'pointSize' );
                        gui.add( material.uniforms.zOffset, 'value', 0, 4000, 1.0 ).name( 'zOffset' );
                        gui.add( window, 'showDepthVideo' ).name('Show Depth Video').onChange(function(value) {
                            if (value)
                                video.style.display = 'block';
                            else
                                video.style.display = 'none';
                        });
                        gui.add( window, 'enableRgbTexture').name('Enable RGB Texture').onChange(function(value) {
                            reset();
                            start();
                        });
                        gui.add( window, 'showBackground').name('Show Background').onChange(function(value) {
                                if (value)
                                    material.uniforms.showBackground.value = 1.0;
                                else
                                    material.uniforms.showBackground.value = 0.0;
                        });
                        gui.add( material.uniforms.depthEncoding, 'value', { Grayscale: 0, Adaptive: 1, Raw: 2 } ).name('Depth Encoding');
                        gui.close();
                    } catch (e) {
                        console.log(e);
                        var div = document.createElement('div');
                        var checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = 'Enable RGB Texture';
                        checkbox.checked = enableRgbTexture;
                        checkbox.onchange = function(event) {
                            if (checkbox.checked)
                                enableRgbTexture = true;
                            else
                                enableRgbTexture = false;
                            reset();
                            start();
                        };
                        var label = document.createElement('label')
                        label.htmlFor = "id";
                        label.appendChild(document.createTextNode('Enable RGB Texture'));
                        label.style.color = 'white';
                        label.style.fontFamily = 'Monospace';
                        label.style.fontSize = '13px';
                        div.appendChild(checkbox);
                        div.appendChild(label);
                        div.style.position = "absolute";
                        div.style.bottom = "0px";
                        div.style.right = "5px";
                        document.body.appendChild(div);
                    }

                    intervalId = setInterval(drawVideo, 1000 / 30 );
                    animate();

                }

                var isDepthVideoReady = false;
                var isRgbVideoReady = false;

                depthVideo.addEventListener( 'loadedmetadata', function(event) {
                    isDepthVideoReady = true;

                    if (!enableRgbTexture)
                        VideoReady();
                    else if (isRgbVideoReady)
                        VideoReady();
                });

                if (enableRgbTexture) {
                    rgbVideo.addEventListener( 'loadedmetadata', function(event) {
                        isRgbVideoReady = true;

                        if (isDepthVideoReady)
                            VideoReady();
                    });
                }

                depthVideo.src = depthStream;
                depthVideo.loop = true;
                depthVideo.play();

                depthVideo.style.position = 'absolute';
                depthVideo.style.top = '0px';
                depthVideo.style.left = '0px';
                document.body.appendChild(depthVideo);

                if (enableRgbTexture) {
                    rgbVideo.src = rgbStream;
                    rgbVideo.loop = true;
                    rgbVideo.play();

                    rgbVideo.style.position = 'absolute';
                    rgbVideo.style.top = '240px';
                    rgbVideo.style.left = '0px';
                    document.body.appendChild(rgbVideo);
                }

                renderer = new THREE.WebGLRenderer();
                renderer.setSize( window.innerWidth, window.innerHeight );
                container.appendChild( renderer.domElement );

                mouse = new THREE.Vector3( 0, 0, 1 );

                window.addEventListener( 'resize', onWindowResize, false );
            }

            function onWindowResize() {

                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();

                renderer.setSize( window.innerWidth, window.innerHeight );

            }


            function animate() {

                animationId = requestAnimationFrame( animate );

                render();
                stats.update();

            }

            function render() {

                renderer.render( scene, camera );

            }
