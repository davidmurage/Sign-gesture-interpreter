---
title: 'Add local meeting overlays for Zoom and Google Meet'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: '4fd786180deea69c78cccf2511ab8ec8653ab037'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users cannot keep gesture recognition visible and copyable while participating in Google Meet or Zoom. Browser meetings and the native Zoom client require different integration surfaces, and neither should depend on undocumented meeting controls.

**Approach:** Add a shared local recognition controller with two thin shells: an explicit-click Manifest V3 Chrome/Edge overlay for Meet and Zoom web, and a locally served Zoom App side panel for the native desktop client. Both capture only after user action, call the existing inference contract, display selectable recognized text, and provide Copy without publishing to the meeting.

## Boundaries & Constraints

**Always:** Support desktop Chrome/Edge on `meet.google.com` and Zoom web plus the Zoom desktop App panel; require explicit Start/Stop; keep frames/results local to the configured inference service; use exact permissions, isolated DOM/CSS, safe text rendering, single-flight requests, timeouts, and full camera cleanup; expose setup limitations and camera-conflict guidance; preserve the existing `/interpret` response contract.

**Ask First:** Any Zoom Marketplace submission, public deployment/tunnel, real Zoom credentials, additional browser/store permissions, telemetry, persistent transcripts, or change to model/data artifacts.

**Never:** Send meeting chat or participant captions; manipulate undocumented Meet/Zoom DOM controls; capture other participants or tab media; auto-start camera/copy; request microphone, cookies, broad browsing access, or Zoom REST data; claim mobile/native Meet support or guaranteed simultaneous use of one camera by the meeting and recognizer.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Supported meeting | User activates shell and grants camera | Draggable/panel UI shows local text and confidence | Copy writes exact visible text |
| Unsupported page/context | Extension click elsewhere or Zoom App outside meeting | No injection/capture | Explain supported surfaces safely |
| No hand | Valid frame without hand | Clear stale result; keep recognition active | Show neutral status |
| Camera unavailable | Denied, already exclusive, or absent | No polling or leaked stream | Guidance to disable meeting video/use second camera |
| Inference unavailable | Offline, timeout, malformed/error response | UI remains stoppable; no overlapping requests | Bounded retry and actionable status |
| Stop/navigation/unload | Active or in-flight recognition | Abort, clear timers, stop every media track | Late results cannot revive session |

</frozen-after-approval>

## Code Map

- `frontend/src/pages/HomePage.js:6-131` — proven camera/session, timeout, single-flight, stable-response, and cleanup behavior to extract without changing current page behavior.
- `frontend/src/pages/HomePage.test.js:47-159` — reusable lifecycle/race test cases.
- `backend2/index.py:116-189` — existing `{handDetected,label,text,confidence,error}` API and safe request boundary; schema stays unchanged.
- `backend2/index.py:149-155` — browser-app CORS context; extension requests should instead originate from its service worker.
- `README.md:1-54` — current local inference setup and static-vocabulary limitations to extend.
- `extension/` — new MV3 browser shell; no extension manifest/build/tests exist today.
- `zoom-app/` — new native Zoom App webview/server shell; requires external Local Test configuration and HTTPS tunnel.
- `_bmad-output/implementation-artifacts/deferred-work.md:7-12` — chat and participant-caption publishing remain separate work.

## Tasks & Acceptance

**Execution:**
- [x] `meeting-overlay/core.js` — implement environment-neutral recognition session/controller and response validation with injectable camera, transport, timer, and clipboard adapters.
- [x] `extension/manifest.json`, `extension/background.js`, `extension/content.js`, `extension/overlay.css` — add explicit-toolbar MV3 injection on allowlisted Meet/Zoom web URLs, service-worker inference transport to fixed/configured loopback hosts, Shadow DOM overlay, drag/minimize/copy/start/stop, and sender/message validation.
- [x] `zoom-app/package.json`, `zoom-app/server.js`, `zoom-app/public/*` — serve a Zoom App panel with required security headers, same-origin bounded inference proxy, Zoom SDK context detection, shared controller UI behavior, and no credential-dependent API calls.
- [x] `extension/tests/*`, `zoom-app/tests/*`, `meeting-overlay/tests/*` — cover every matrix row with DOM/network/media/Zoom/chrome mocks, including injection idempotence, sender allowlists, proxy bounds, camera conflicts, Copy, restart races, and unload cleanup.
- [x] `README.md`, `extension/README.md`, `zoom-app/README.md`, scoped `.env.example` files — document unpacked Chrome/Edge installation, supported URLs, native Zoom General App/Local Test and HTTPS-tunnel steps, required `zoomapp:inmeeting` scope, privacy, and unsupported surfaces.

**Acceptance Criteria:**
- Given a supported Meet or Zoom web tab, when the toolbar action is clicked, then exactly one isolated overlay appears without changing meeting controls or requesting broad host permissions.
- Given the native Zoom App is loaded through Local Test, when it runs in a meeting, then its local panel can start recognition, display/copy results, and report its Zoom running context without Zoom REST credentials.
- Given either shell receives the same mocked frame/result sequence, when recognition runs, then observable status, stale clearing, timeout, retry, Copy, and cleanup behavior are equivalent.
- Given no meeting credentials or physical camera are available, when automated tests run, then all browser, Zoom-context, proxy, and controller paths complete with mocks.

## Spec Change Log

## Design Notes

The browser shell uses `activeTab` + `scripting`, exact runtime URL checks, and inference-only loopback host permissions. The native shell is an HTTPS-tunneled local web app because Zoom validates Home URLs and security headers; its same-origin server proxy reaches local Flask without exposing mixed-content requests in the Zoom WebView. Official constraints: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [extension cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [Zoom App creation](https://developers.zoom.us/docs/zoom-apps/create/), and [Zoom App architecture](https://developers.zoom.us/docs/zoom-apps/architecture/).

## Verification

**Commands:**
- `node --test meeting-overlay/tests/*.test.js extension/tests/*.test.js zoom-app/tests/*.test.js` — controller, extension, proxy, and Zoom shell contracts pass.
- `npm.cmd test -- --watchAll=false --runTestsByPath src/MeetingShells.test.js` from `frontend` — shipped extension and Zoom panel DOM/media lifecycle wiring passes in jsdom.
- `npm.cmd test -- --watchAll=false` from `frontend` — existing interpreter behavior remains green.
- `npm.cmd run build` from `frontend` — existing web app still builds.
- `node --check` on every new runtime JS file and `git diff --check` — syntax and patch hygiene pass.

**Manual checks (if no CLI):**
- Load the unpacked extension in current Chrome and Edge; smoke-test a Meet tab and Zoom Web App with camera on/off.
- Configure a Zoom General App Local Test Home URL through an HTTPS tunnel; confirm the desktop side panel starts/stops, copies text, and releases camera.

## Suggested Review Order

**Shared recognition lifecycle**

- One controller enforces camera ownership, single-flight inference, retries, and exact Copy output.
  [`core.js:22`](../../meeting-overlay/core.js#L22)

**Browser meeting overlay**

- Toolbar activation gates supported URLs and reports injection failures safely.
  [`background.js:7`](../../extension/background.js#L7)

- Shadow DOM wiring owns idempotence, camera controls, drag, Copy, and cleanup.
  [`content.js:3`](../../extension/content.js#L3)

**Native Zoom boundary**

- The local server protects tunneled inference with CSRF, bounds, validation, and security headers.
  [`server.js:8`](../../zoom-app/server.js#L8)

- Zoom SDK context gating enables recognition only inside meetings.
  [`app.js:8`](../../zoom-app/public/app.js#L8)

**Verification**

- Executable jsdom tests exercise both shipped DOM/media shells end-to-end.
  [`MeetingShells.test.js:24`](../../frontend/src/MeetingShells.test.js#L24)

- Proxy tests cover origin protection, limits, schema validation, and timeouts.
  [`server.test.js:6`](../../zoom-app/tests/server.test.js#L6)
