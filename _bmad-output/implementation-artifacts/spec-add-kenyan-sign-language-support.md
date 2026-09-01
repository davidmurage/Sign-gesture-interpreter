---
title: 'Add experimental Kenyan Sign Language recognition'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8d3488b5aa914e4d58cad42f7b7a65da7b09c3b1'
context:
  - '{project-root}/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The interpreter's bundled 32-class, single-frame artifact has no documented Kenyan Sign Language provenance and cannot recognize temporal KSL signs. Presenting it as KSL would be inaccurate and would produce unreliable translations.

**Approach:** Add an opt-in experimental KSL provider using the MIT-licensed 30-word MediaPipe Holistic/LSTM artifact from Ibrahim Shedoh, with its exact temporal preprocessing isolated behind a stable recognizer interface. Preserve the existing static provider and `/interpret` contract, expose model capabilities/vocabulary, and label KSL results as isolated-word recognition rather than continuous translation.

## Boundaries & Constraints

**Always:** Preserve `backend/.env` byte-for-byte; retain the current static provider as the default; validate the external artifact, label order, input/output shapes, source, and license before activation; use 30-frame MediaPipe Holistic sequences of 1662 features for the KSL provider; support abstention for no-person, unstable, low-confidence, and out-of-vocabulary input; keep frontend, overlay, extension, and Zoom clients backward-compatible; document that accuracy and signer generalization are not independently established.

**Ask First:** Stop if the upstream model/license differs from the researched MIT artifact, the checkpoint cannot be safely loaded, its actual labels or tensor contract differ, or integration would require replacing the existing model/API rather than adding a provider.

**Never:** Claim continuous KSL translation, production accuracy, or KSL-expert validation; silently treat Korean Sign Language assets as Kenyan KSL; train on or redistribute a dataset without verified usage rights; infer a label mapping from output position without an authoritative source; modify `backend/.env` or the user's tooling directories.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Static default | Existing client posts one image without a provider | Existing static recognition behavior and schema remain intact | Existing validation errors remain stable |
| KSL warm-up | KSL mode receives fewer than 30 usable frames | Return a valid non-result with progress/status, not a guessed word | Clear sequence on tracking loss or timeout |
| KSL recognition | Thirty compatible Holistic frames form a stable prediction | Return canonical gloss, display text, confidence, and `ksl-experimental` provider metadata | Abstain below configured confidence/stability thresholds |
| No sign / unknown | No landmarks, unrelated gesture, or unsupported sign | Return no recognized text and an explicit non-fatal status | Never publish a guessed meeting caption/chat message |
| Artifact mismatch | Missing/corrupt checkpoint or incompatible labels/shapes | Static provider still starts; KSL capability reports unavailable | Log actionable diagnostic without leaking paths/secrets |

</frozen-after-approval>

## Code Map

- `backend2/index.py` -- current Flask API, image decoding, static engine, and stable response schema.
- `backend2/Model/` -- existing static artifact and positional labels; must remain unchanged.
- `backend2/providers/` -- new recognizer/provider boundary and experimental temporal KSL implementation.
- `backend2/models/ksl-lstm-v1/` -- validated third-party artifact metadata, labels, source/license record, and checkpoint or reproducible fetch instructions.
- `backend2/tests/test_api.py` -- API compatibility, provider selection, initialization, and failure behavior.
- `frontend/src/pages/HomePage.js` -- provider selection, capability/vocabulary disclosure, and temporal polling status.
- `meeting-overlay/core.js` -- prevents warm-up/abstained results from being published.
- `README.md` -- exact vocabulary, limitations, artifact provenance, setup, and run instructions.

## Tasks & Acceptance

**Execution:**
- [x] `backend2/providers/*` -- introduce a provider contract and implement the exact 30-frame/1662-feature KSL preprocessing and inference lifecycle.
- [x] `backend2/index.py` -- route explicitly selected providers while preserving default behavior and add a capability endpoint with non-secret metadata.
- [x] `backend2/models/ksl-lstm-v1/*` -- verify and record artifact checksum, authoritative label order, upstream URL/commit, license, model contract, and limitations.
- [x] `backend2/tests/*` -- cover sequence warm-up/reset, label mapping, thresholds, malformed artifacts, unavailable provider, and backward compatibility using fakes rather than the large model.
- [x] `frontend/src/pages/HomePage.js` and tests -- add KSL mode, show its experimental/isolated-word scope and supported vocabulary, and handle warm-up/abstention safely.
- [x] `meeting-overlay/core.js` and tests -- publish only finalized KSL recognitions and suppress duplicates/non-results.
- [x] `README.md` -- document installation, artifact provenance, vocabulary, runtime selection, privacy, and honest evaluation limitations.

**Acceptance Criteria:**
- Given an unchanged installation, when clients omit provider selection, then all existing static interpreter tests and behavior continue to pass.
- Given KSL mode, when a temporal sequence is incomplete or fails thresholds, then no recognized text is exposed for meeting publication.
- Given a validated KSL artifact, when a stable supported isolated sign is processed, then its label comes from the authoritative 30-class mapping and the response identifies the experimental KSL provider.
- Given a missing or incompatible KSL artifact, when the service starts, then static recognition remains available and capabilities accurately report KSL as unavailable.
- Given the UI, when KSL mode is selected, then users can inspect the exact supported vocabulary and see that continuous sentences and production accuracy are not promised.

## Spec Change Log

## Design Notes

The temporal provider should own per-session frame state. Clients identify a stream/session so frames from different cameras or restarts cannot mix. Provider-specific response metadata may be additive, while the existing top-level fields (`handDetected`, `label`, `text`, `confidence`, `error`) remain compatible. The upstream checkpoint is a prototype baseline; its integration creates a replaceable KSL path, not evidence of linguistic validation.

## Verification

**Commands:**
- `.\.venv\Scripts\python.exe -m unittest discover -s backend2\tests -v` -- expected: all backend tests pass, including provider compatibility and KSL sequence tests.
- `cd frontend; npm test -- --watchAll=false` -- expected: all frontend tests pass.
- `cd meeting-overlay; npm test` -- expected: overlay publication tests pass.
- `git diff --check` -- expected: no whitespace errors; `backend/.env` absent from implementation diff.

## Suggested Review Order

**Temporal recognition core**

- Start with the provider lifecycle, session isolation, abstention, and reset boundary.
  [`ksl.py:118`](../../backend2/providers/ksl.py#L118)

- Verify checksummed weight loading reconstructs the pinned artifact safely.
  [`ksl.py:65`](../../backend2/providers/ksl.py#L65)

- Review the 30-frame sequence and hand-presence requirements.
  [`ksl.py:163`](../../backend2/providers/ksl.py#L163)

**API and clients**

- Provider routing preserves the original static API by default.
  [`index.py:158`](../../backend2/index.py#L158)

- Frontend selection uses KSL-specific cadence and discloses limitations.
  [`HomePage.js:159`](../../frontend/src/pages/HomePage.js#L159)

- Meeting responses expose progress while suppressing unfinished predictions.
  [`core.js:11`](../../meeting-overlay/core.js#L11)

- Zoom proxy accepts only sanitized provider and session metadata.
  [`server.js:34`](../../zoom-app/server.js#L34)

**Evidence and documentation**

- Temporal tests cover warm-up, stabilization, reset, abstention, and hand absence.
  [`test_ksl.py:59`](../../backend2/tests/test_ksl.py#L59)

- Meeting tests prove unfinished KSL results cannot be copied.
  [`core.test.js:10`](../../meeting-overlay/tests/core.test.js#L10)

- User documentation names the exact vocabulary and research limitations.
  [`README.md:12`](../../README.md#L12)
