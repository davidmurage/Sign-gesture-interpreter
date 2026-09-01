# Sign Gesture Interpreter

This project uses the browser camera with either the original static model or an
opt-in experimental Kenyan Sign Language (KSL) temporal model. It is not
continuous sign-language translation and does not interpret KSL grammar or
arbitrary signs.

## Supported vocabulary

`A`–`Z`, `Yes`, `Hello`, `Thankyou`, `No`, `Okay`, and `Bathroom`. Results are limited by the supplied model and its training data; no accuracy guarantee is implied.

Experimental KSL mode recognizes these isolated words: `me`, `you`, `friend`,
`name`, `mine`, `who`, `how`, `please`, `help-me`, `wait`, `now`, `home`,
`where`, `give-me`, `thank-you`, `polite`, `hello`, `good`, `mother`, `father`,
`uncle`, `cousing`, `brother`, `sister`, `doughter`, `parent`, `relative`,
`yes`, `no`, and `sorry`. The upstream misspellings are retained internally to
preserve model label order but displayed as “Cousin” and “Daughter.”

## Prerequisites and setup

- Node.js 18+ and npm
- Python 3.10 or 3.11
- A browser with camera permission

From the repository root:

```powershell
uv venv --python 3.11 .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend2\requirements.txt
Copy-Item frontend\.env.example frontend\.env
Copy-Item backend\.env.example backend\.env
```

Run `npm install` in both `backend` and `frontend`. Replace the safe
`MONGO_URL` and `JWT_SECRET` placeholders in `backend/.env`; do not commit them.
The inference service reads `INFERENCE_HOST`, `INFERENCE_PORT`, and
`CORS_ORIGINS` from its process environment (the root `.env.example` is a
reference, not automatically loaded). The frontend reads
`REACT_APP_INFERENCE_URL` from `frontend/.env` at start/build time.

## Run locally

Use separate terminals from the repository root:

```powershell
$env:INFERENCE_PORT=5001; $env:CORS_ORIGINS='http://localhost:3000,http://127.0.0.1:3000'; python backend2\index.py
Set-Location backend; $env:PORT=5000; npm start
Set-Location frontend; npm start
```

Auth defaults to port 5000 and inference to port 5001. Set
`frontend/.env`'s `REACT_APP_INFERENCE_URL` before starting or building the
frontend when inference runs elsewhere. Set `CORS_ORIGINS` to a comma-separated
allowlist of frontend origins; its safe default permits only local port 3000.
Model assets are resolved relative to `backend2/index.py`, independently of the
launch directory.

Select **Experimental Kenyan KSL** in the frontend to use the temporal provider.
It needs at least 30 consecutive tracked frames and three stable predictions.
`KSL_CONFIDENCE_THRESHOLD` (default `0.70`) and `KSL_STABILITY_FRAMES` (default
`3`) may be set in the inference process environment. Do not put them in
`backend/.env`; that file belongs to the authentication backend.

## Test

```powershell
python -m unittest discover -s backend2/tests -v
Set-Location frontend; npm.cmd test -- --watchAll=false
Set-Location frontend; npm.cmd run build
node --check backend/server.js
```

Tests mock camera, hand detection, and model inference; a camera and GPU are not required.

## Meeting overlays

For a local, selectable recognition overlay in Google Meet or Zoom Web App, see
`extension/README.md`. For the native Zoom desktop side panel Local Test, see
`zoom-app/README.md`. Both offer static and experimental KSL modes, require an
explicit Start, keep frames/results local to the configured inference service,
and provide Copy only; they do not publish meeting chat or participant captions.
Warm-up, unstable, low-confidence, and unsupported results are never copyable.
Camera hardware may not permit simultaneous meeting video and recognition.

## Data and model limitations

The original bundled model is read-only project data. The repository contains a very small
sample image set, but no reproducible training pipeline, provenance details,
validation split, or accuracy metrics. Predictions are demonstrations, not
authoritative translations.

The experimental KSL checkpoint and provenance manifest are in
`backend2/models/ksl-lstm-v1`. It comes from Ibrahim Shedoh's MIT-described open
research repository. Its accuracy, signer-independent generalization,
calibration, and KSL-expert validation have not been established. The unchanged
upstream artifact is SHA-256 checked before its weights are loaded.
