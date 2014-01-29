WebRTC client and server with Depth Stream

This example application will only permit a maximum of two peers to share a room.

Steps:
# Ensure you have Node, socket.io and node-static installed. Node can be downloaded from nodejs.org; installation is straightforward and quick. To install socket.io and node-static, run Node Package Manager from a terminal in your application directory:

    npm install socket.io
    npm install node-static

# To start the server, run the following command from a terminal in your application directory:

    node server.js

# On one of your clients, navigate browser to <server_ip>:2013. On another client, repeat it.

The example is based on:
https://bitbucket.org/webrtc/codelab