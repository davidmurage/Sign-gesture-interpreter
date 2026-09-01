# Sign Gesture Interpreter

This project uses the browser camera to classify one static hand gesture at a time with the supplied Keras model. It is not continuous sign-language translation and does not interpret motion, grammar, facial expression, or arbitrary signs.

## Supported vocabulary

`A`–`Z`, `Yes`, `Hello`, `Thankyou`, `No`, `Okay`, and `Bathroom`. Results are limited by the supplied model and its training data; no accuracy guarantee is implied.

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

## Test

```powershell
python -m unittest discover -s backend2/tests -v
Set-Location frontend; npm.cmd test -- --watchAll=false
Set-Location frontend; npm.cmd run build
node --check backend/server.js
```

Tests mock camera, hand detection, and model inference; a camera and GPU are not required.

## Data and model limitations

The bundled model is read-only project data. The repository contains a very small
sample image set, but no reproducible training pipeline, provenance details,
validation split, or accuracy metrics. Dynamic signing is unsupported.
Predictions are demonstrations, not authoritative translations.
