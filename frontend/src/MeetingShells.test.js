import { act, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

const source = (...parts) => fs.readFileSync(path.resolve(__dirname, '..', '..', ...parts), 'utf8');
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
  document.documentElement.innerHTML = '<head></head><body></body>';
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: jest.fn().mockResolvedValue() });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage: jest.fn() }));
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,YQ==');
});

afterEach(() => {
  delete window.MeetingOverlayCore;
  delete window.ZoomContext;
  delete window.zoomSdk;
  delete window.chrome;
  jest.restoreAllMocks();
});

test('shipped extension shell is idempotent, captures, copies visible result, and stops on toggle/pagehide', async () => {
  const stop = jest.fn();
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  window.chrome = { runtime: { lastError: null, sendMessage: (_message, callback) => callback({ ok: true, data: { handDetected: true, text: 'Hello', confidence: 91.25 } }) } };
  window.eval(source('meeting-overlay', 'core.js'));
  const content = source('extension', 'content.js');
  window.eval(content);
  const host = document.getElementById('sign-gesture-overlay-host');
  expect(host).not.toBeNull();
  const shadow = host.shadowRoot;
  fireEvent.click(shadow.querySelector('.toggle'));
  await flush();
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  await flush();
  expect(shadow.querySelector('.text').textContent).toBe('Hello (91.25%)');
  fireEvent.click(shadow.querySelector('.copy'));
  await flush();
  expect(writeText).toHaveBeenCalledWith('Hello (91.25%)');
  window.eval(content);
  await flush();
  expect(document.querySelectorAll('#sign-gesture-overlay-host')).toHaveLength(1);
  expect(stop).toHaveBeenCalled();
  expect(host.hidden).toBe(true);
  window.eval(content);
  await flush();
  expect(host.hidden).toBe(false);
  expect(shadow.querySelector('.toggle').textContent).toBe('Start');
  fireEvent.click(shadow.querySelector('.toggle'));
  await flush();
  window.dispatchEvent(new Event('pagehide'));
  await flush();
  expect(stop.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test('shipped Zoom inMeeting panel enables Start, renders/copies exact result, and stops on pagehide', async () => {
  document.body.innerHTML = '<p id="context"></p><video></video><canvas width="320" height="240"></canvas><p id="status"></p><strong id="result"></strong><p id="error"></p><button id="toggle" disabled>Start</button><button id="copy" disabled>Copy</button>';
  const stop = jest.fn(), writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  window.zoomSdk = { config: jest.fn().mockResolvedValue({}), getRunningContext: jest.fn().mockResolvedValue({ context: 'inMeeting' }) };
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ json: async () => ({ csrfToken: 'token' }) })
    .mockResolvedValue({ ok: true, json: async () => ({ handDetected: true, text: 'Yes, I agree.', confidence: 88 }) });
  window.eval(source('meeting-overlay', 'core.js'));
  window.eval(source('zoom-app', 'public', 'context.js'));
  window.eval(source('zoom-app', 'public', 'app.js'));
  await flush();
  expect(window.zoomSdk.config).toHaveBeenCalledWith(expect.objectContaining({ version: '0.16.0' }));
  expect(document.getElementById('toggle').disabled).toBe(false);
  fireEvent.click(document.getElementById('toggle'));
  await flush(); await flush();
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  expect(document.getElementById('result').textContent).toBe('Yes, I agree. (88.00%)');
  fireEvent.click(document.getElementById('copy'));
  await flush();
  expect(writeText).toHaveBeenCalledWith('Yes, I agree. (88.00%)');
  window.dispatchEvent(new Event('pagehide'));
  await flush();
  expect(stop).toHaveBeenCalled();
});
