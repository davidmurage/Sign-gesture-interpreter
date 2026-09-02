# Experimental KSL model provenance

`best_model.h5` was downloaded from Ibrahim Shedoh's Kenyan Sign Language
Recognition repository at commit
`6cc960d8ddea7bd3de71fb3ea68c2fe8be07cd11`. The upstream README states that
the project is MIT licensed and documents a 30-frame, 1662-feature MediaPipe
Holistic LSTM with the label order recorded in `manifest.json`. The loader
reconstructs the layer configuration serialized in this artifact (including
its batch-normalization and dropout layers), which is more specific than the
simplified architecture shown in the upstream README.

This repository reconstructs that documented architecture and loads only its
weights because the upstream HDF5 model configuration was saved by a newer
Keras serializer than TensorFlow 2.15 supports. The original artifact is kept
unchanged and verified by SHA-256 before loading.

This is an experimental research baseline, not a production-quality KSL
translator. It has no published signer-independent evaluation or accuracy
guarantee and recognizes only the isolated words listed in the manifest.
The upstream repository does not provide a separate license file; redistribution
here relies on the MIT license declaration in its pinned README.
