(function () {
  'use strict';
  const HOST_ID = 'sign-gesture-overlay-host';
  const prior = document.getElementById(HOST_ID);
  if (prior) { prior.dispatchEvent(new CustomEvent('sign-overlay-toggle')); return; }
  const host = document.createElement('div'); host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>:host{font-family:system-ui;color:#fff}.box{width:300px;background:#17202a;border:1px solid #8993a0;border-radius:12px;box-shadow:0 8px 30px #0008;overflow:hidden}.head{padding:10px 12px;background:#243447;cursor:move;display:flex;justify-content:space-between}.body{padding:12px}.result{min-height:48px;padding:8px;border:1px solid #667;border-radius:6px;user-select:text}.error{color:#ffd2d2}.actions{display:flex;gap:8px;margin-top:10px}button{border:0;border-radius:5px;padding:7px 10px;cursor:pointer}.hidden{display:none}</style><section class="box" aria-label="Local sign gesture overlay"><div class="head"><strong>Sign Interpreter</strong><button class="min" aria-label="Minimize">−</button></div><div class="body"><video hidden playsinline muted></video><canvas hidden width="320" height="240"></canvas><div class="result" role="status" aria-live="polite"><div class="status">Camera is stopped.</div><strong class="text"></strong><div class="error"></div></div><div class="actions"><button class="toggle">Start</button><button class="copy" disabled>Copy</button><button class="close">Close</button></div></div></section>`;
  document.documentElement.appendChild(host);
  const $ = (s) => shadow.querySelector(s), video = $('video'), canvas = $('canvas');
  const mode = document.createElement('select');
  mode.className = 'mode'; mode.setAttribute('aria-label', 'Recognition mode');
  mode.innerHTML = '<option value="static">Static gestures</option><option value="ksl-experimental">Experimental Kenyan KSL (30 isolated words)</option>';
  video.before(mode);
  let stream;
  const camera = { start: async () => { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false }); video.srcObject = stream; await video.play(); }, capture: async () => { if (!video.videoWidth) return null; canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', .75); }, stop: async () => { if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null; video.srcObject = null; } };
  const transport = (image, signal, options) => new Promise((resolve, reject) => {
    const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); signal.addEventListener('abort', abort, { once: true });
    chrome.runtime.sendMessage({ type: 'INTERPRET_FRAME', image, ...options }, (reply) => { signal.removeEventListener('abort', abort); if (signal.aborted) return; if (chrome.runtime.lastError || !reply?.ok) reject(new Error('transport')); else resolve(reply.data); });
  });
  const clipboard = { writeText: (text) => navigator.clipboard.writeText(text) };
  const controller = MeetingOverlayCore.createController({ camera, transport, clipboard,
    provider: () => mode.value, onState(state) { $('.status').textContent = state.status; $('.text').textContent = state.visibleText; $('.error').textContent = state.error; $('.copy').disabled = !state.visibleText; $('.toggle').textContent = state.active ? 'Stop' : 'Start'; mode.disabled = state.active; } });
  $('.toggle').addEventListener('click', () => controller.getState().active ? controller.stop() : controller.start());
  $('.copy').addEventListener('click', () => controller.copy().catch(() => { $('.error').textContent = 'Copy failed. Select the recognized text and copy it manually.'; }));
  $('.min').addEventListener('click', () => $('.body').classList.toggle('hidden'));
  $('.close').addEventListener('click', async () => { await controller.stop(); host.remove(); });
  host.addEventListener('sign-overlay-toggle', async () => { await controller.stop(); host.hidden = !host.hidden; });
  let drag;
  $('.head').addEventListener('pointerdown', (event) => { if (event.target.closest('button')) return; drag = { x: event.clientX, y: event.clientY, left: host.offsetLeft, top: host.offsetTop }; $('.head').setPointerCapture(event.pointerId); });
  $('.head').addEventListener('pointermove', (event) => { if (!drag) return; host.style.left = `${Math.max(0, drag.left + event.clientX - drag.x)}px`; host.style.top = `${Math.max(0, drag.top + event.clientY - drag.y)}px`; host.style.right = 'auto'; });
  $('.head').addEventListener('pointerup', () => { drag = null; });
  const initialUrl = location.href;
  const navigationWatch = setInterval(() => { if (location.href !== initialUrl) { clearInterval(navigationWatch); controller.stop(); } }, 500);
  window.addEventListener('pagehide', () => { clearInterval(navigationWatch); controller.stop(); }, { once: true });
})();
