(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeetingOverlayCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT_DELAY = 1000;
  const DEFAULT_TIMEOUT = 8000;

  function validateResponse(data) {
    if (!data || typeof data.handDetected !== 'boolean') throw new Error('protocol');
    if (data.handDetected && typeof (data.text || data.label) !== 'string') throw new Error('protocol');
    return data.handDetected
      ? { text: data.text || data.label, confidence: Number.isFinite(data.confidence) ? data.confidence : null }
      : { text: null, confidence: null };
  }

  function visibleText(result) {
    return result.text ? `${result.text}${result.confidence !== null ? ` (${result.confidence.toFixed(2)}%)` : ''}` : '';
  }

  function createController(options) {
    const camera = options.camera;
    const transport = options.transport;
    const timers = options.timers || { setTimeout, clearTimeout };
    const delay = options.pollDelayMs || DEFAULT_DELAY;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT;
    const emit = options.onState || function () {};
    let session = 0, active = false, starting = false, timer = null, request = null;
    let state = { active: false, status: 'Camera is stopped.', text: null, visibleText: '', confidence: null, error: '' };
    const update = (next) => { state = { ...state, ...next }; emit({ ...state }); };
    const schedule = (id) => { if (active && id === session) timer = timers.setTimeout(() => poll(id), delay); };

    async function poll(id) {
      if (!active || id !== session || request) return;
      let image;
      try { image = await camera.capture(); }
      catch (_) { if (active && id === session) update({ text: null, visibleText: '', confidence: null, error: 'Camera capture failed. Retrying…' }); return schedule(id); }
      if (!active || id !== session) return;
      if (!image) return schedule(id);
      const controller = new AbortController();
      request = controller;
      const timeout = timers.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const data = await transport(image, controller.signal);
        const result = validateResponse(data);
        if (active && id === session && request === controller) update({ ...result, visibleText: visibleText(result), error: '', status: result.text ? 'Gesture recognized.' : 'No hand detected.' });
      } catch (error) {
        if (active && id === session && request === controller) {
          const message = error && error.name === 'AbortError' ? 'The inference request timed out. Retrying…'
            : error && error.message === 'protocol' ? 'The inference service returned an invalid response. Retrying…'
              : 'The inference service is unavailable. Retrying…';
          update({ text: null, visibleText: '', confidence: null, error: message });
        }
      } finally {
        timers.clearTimeout(timeout);
        if (request === controller) request = null;
        schedule(id);
      }
    }

    async function start() {
      if (starting || active) return;
      starting = true;
      await stop();
      const id = session;
      update({ active: false, text: null, visibleText: '', confidence: null, error: '', status: 'Requesting camera permission…' });
      try {
        await camera.start();
        if (id !== session) { try { await camera.stop(); } catch (_) {} return; }
        active = true;
        update({ active: true, status: 'Camera is running.' });
        poll(id);
      } catch (_) {
        try { await camera.stop(); } catch (_) {}
        update({ active: false, status: 'Camera could not start.', error: 'Camera is unavailable. Check permission, disable meeting video, or use a second camera.' });
      } finally { starting = false; }
    }
    async function stop() {
      session += 1; active = false;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      if (request) request.abort();
      request = null;
      try { await camera.stop(); } catch (_) {}
      update({ active: false, text: null, visibleText: '', confidence: null, error: '', status: 'Camera is stopped.' });
    }
    async function copy() {
      if (!state.visibleText) return false;
      await options.clipboard.writeText(state.visibleText);
      return true;
    }
    return { start, stop, copy, getState: () => ({ ...state }), validateResponse };
  }
  return { createController, validateResponse, visibleText, DEFAULT_DELAY, DEFAULT_TIMEOUT };
});
