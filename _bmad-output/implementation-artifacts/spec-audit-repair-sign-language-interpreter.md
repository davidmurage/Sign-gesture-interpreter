---
title: 'Repair the core sign-language interpreter'
type: 'bugfix'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c65a8523c94df1e6d0948c26de45e8acae78f70b'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The browser-to-text path is not dependable: labels never match, the auth and inference services contend for port 5000, model paths depend on the launch directory, image handling is inconsistent, and the project lacks a reproducible Python setup or meaningful automated checks.

**Approach:** Make browser frame inference the single camera path, define a stable and validated inference API, normalize model labels correctly, separate configurable service endpoints, and add focused tests and setup documentation so the core interpreter can be run and verified end to end.

## Boundaries & Constraints

**Always:** Preserve the existing React, Flask, MediaPipe, and supplied Keras-model stack; load model assets relative to the Python module; keep secrets and deploy-specific URLs out of source; return consistent JSON for success, no-hand, and invalid-input outcomes; release browser media and polling resources on stop/unmount; document that recognition is limited to the supplied model's static classes.

**Ask First:** Any model replacement or retraining, dataset deletion, public deployment, database migration, or change that requires credentials or a paid service.

**Never:** Implement Zoom/Google Meet integration in this change; claim unsupported accuracy or full natural sign-language translation; use the Flask host's webcam/GUI; expose raw stack traces; modify unrelated authentication/account-recovery behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Recognized hand | Valid browser JPEG with a supported gesture | Normalized label/text and numeric confidence | HTTP 200 with stable schema |
| No hand | Valid image without hand landmarks | No stale prediction; `handDetected: false`, null label/confidence | HTTP 200 |
| Invalid frame | Missing, malformed, non-image, or oversized payload | No inference or server crash | HTTP 400/413 with safe message |
| Camera denied | Browser rejects media permission | Capture remains stopped and user sees guidance | UI error; no polling |
| Slow/failing inference | Request exceeds polling interval or API is unavailable | No overlapping/stale requests; UI remains stoppable | Visible error and clean retry |

</frozen-after-approval>

## Code Map

- `backend2/index.py:27-201` — Flask inference service, shared MediaPipe/model state, broken label mapping, browser-image channel conversion, server-camera thread, and API response shape.
- `backend2/Model/labels.txt:1-32` — Teachable Machine labels include numeric prefixes (`0 A`, `27 Hello`, `28 Thankyou`) that must be parsed without changing class order.
- `backend2/Model/keras_model.h5` — existing classifier artifact; read-only unless the human approves replacement.
- `frontend/src/pages/HomePage.js:10-100` — browser webcam lifecycle, hardcoded inference URL, overlapping interval requests, and result/error rendering.
- `frontend/src/styles/HomePage.css:1-71` — case-sensitive import target and non-responsive fixed webcam layout.
- `frontend/package.json:3` — auth proxy currently occupies port 5000; inference must use a distinct configurable endpoint.
- `backend/server.js:35-40` — Node auth service defaults to port 5000; read-only context for port separation.
- `backend2/test.py` — manual infinite webcam program, not an automated test; do not treat as verification.
- `frontend/README.md` — CRA boilerplate to replace or supplement with actual local setup and interpreter limitations.

## Tasks & Acceptance

**Execution:**
- [x] `backend2/index.py` — refactor to browser-frame-only inference; validate/decode bounded input; preserve RGB correctly; parse numeric label prefixes; return a stable schema; remove host webcam/GUI lifecycle and cross-client prediction leakage.
- [x] `backend2/requirements.txt` — pin a compatible, reproducible Python runtime dependency set for Flask, CORS, Pillow, OpenCV, MediaPipe, NumPy, and TensorFlow.
- [x] `backend2/tests/test_api.py` — add deterministic API tests with model/hand detection isolated from physical camera and GPU requirements, covering every matrix row applicable to the API.
- [x] `frontend/src/pages/HomePage.js` — use a configurable inference base URL on a separate default port; make capture completion-scheduled/cancellable; handle permission/API states; clear stale output and release tracks.
- [x] `frontend/src/styles/HomePage.css` — make the camera/results layout responsive and add accessible status presentation; correct import casing in its consumer.
- [x] `frontend/src/pages/HomePage.test.js` — test start/stop, denial, no-hand, API failure, and non-overlapping polling behavior with browser/network mocks.
- [x] `backend/package.json` — make the documented auth-service start command invoke Node while preserving its configurable port.
- [x] `README.md` and `.env.example` — document supported static vocabulary, prerequisites, environment variables, separate service ports, install/run/test commands, and known model/data limitations.
- [x] `.gitignore` — ignore generated Python/Node/editor/environment artifacts without removing user data or tracked dependencies in this change.

**Acceptance Criteria:**
- Given both existing services are configured locally, when they start, then auth and inference bind distinct ports and the frontend can address each without a source edit.
- Given the repository is launched using documented commands from the project root, when Flask initializes, then it loads the supplied model/labels independent of the current working directory.
- Given a class returned by the supplied label file, when inference succeeds, then the API returns the normalized class rather than `Gesture not recognized` solely because of its numeric prefix.
- Given repeated capture is started and stopped, when the component unmounts or Stop is pressed, then no request timer, in-flight update, or browser media track remains active.
- Given no physical camera is available, when automated backend and frontend tests run, then they complete using mocks and exercise success and failure contracts.

## Spec Change Log

## Design Notes

Use one response contract across outcomes: `{ handDetected, label, text, confidence, error }`, with nullable prediction fields. The frontend owns the user's camera; Flask accepts bounded snapshots only. Serialize access to non-thread-safe inference objects or otherwise isolate request state, but never share temporal predictions between clients.

## Verification

**Commands:**
- `python -m unittest discover -s backend2/tests -v` — backend contract and edge-case tests pass without a camera.
- `npm.cmd test -- --watchAll=false` from `frontend` — focused webcam/inference component tests pass.
- `npm.cmd run build` from `frontend` — production bundle compiles, including on case-sensitive file systems.
- `node --check backend/server.js` — unchanged auth server remains syntactically valid.

**Manual checks (if no CLI):**
- Start the documented services, grant webcam access, show several supported static signs, and confirm live text/confidence updates; stop capture and confirm the camera indicator turns off.

## Suggested Review Order

**Inference boundary**

- Browser-frame inference is isolated behind one validated, serialized engine.
  [`index.py:61`](../../backend2/index.py#L61)

- Bounded decoding rejects malformed, oversized, and decompression-heavy images safely.
  [`index.py:121`](../../backend2/index.py#L121)

- The Flask factory controls CORS, lazy initialization, and stable response semantics.
  [`index.py:149`](../../backend2/index.py#L149)

**Browser camera lifecycle**

- Session cancellation owns timers, requests, media tracks, and stale-state prevention.
  [`HomePage.js:26`](../../frontend/src/pages/HomePage.js#L26)

- Completion-scheduled capture prevents overlap while handling timeout and protocol errors.
  [`HomePage.js:44`](../../frontend/src/pages/HomePage.js#L44)

- Media callbacks start once and fully clean up permission failures.
  [`HomePage.js:115`](../../frontend/src/pages/HomePage.js#L115)

**Verification and setup**

- Engine tests verify real crop normalization, label selection, and malformed outputs.
  [`test_api.py:131`](../../backend2/tests/test_api.py#L131)

- Lifecycle tests prove stop and unmount abort in-flight work.
  [`HomePage.test.js:95`](../../frontend/src/pages/HomePage.test.js#L95)

- Reproducible Python 3.11 setup and separate service commands anchor local operation.
  [`README.md:18`](../../README.md#L18)

- The auth package script now invokes Node correctly.
  [`package.json:8`](../../backend/package.json#L8)
