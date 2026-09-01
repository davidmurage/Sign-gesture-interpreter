# Browser meeting overlay

Start the local inference service on `127.0.0.1:5001`. Open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select this `extension` directory. On `https://meet.google.com/` or a `https://*.zoom.us/` Zoom Web App meeting, click the extension toolbar button, then **Start**.

The overlay is local, draggable, selectable, and copyable. It never edits meeting controls or publishes chat/captions. It requests camera access only after Start. If the camera is exclusive, disable meeting video or use a second camera. Desktop Chrome/Edge only; native/mobile Meet and native Zoom use different surfaces.
