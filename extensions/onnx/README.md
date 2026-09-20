# @openclaw/onnx

Official local ONNX decision-model plugin for OpenClaw. It evaluates Choice,
Score, and Boolean rubrics with GLiClass, GLiNER2.5, and DeBERTa classifiers in a
persistent CPU inference process.

## Setup

For an unpublished candidate, install the locally packed plugin and explicitly
download a model:

```sh
openclaw plugins install npm-pack:/path/to/openclaw-onnx.tgz
openclaw onnx models
openclaw onnx download gliclass-edge-v3.0
openclaw onnx probe gliclass-edge-v3.0
```

Select `onnx/gliclass-edge-v3.0` as `agents.defaults.decisionModel` or as an
agent's override. Inference stays local; model downloads use pinned revisions,
sizes, and SHA256 hashes. Large models may need preloading to meet the host's
five-second decision deadline.

See [Local ONNX decision models](https://docs.openclaw.ai/plugins/onnx) for the
model catalog, configuration, local exports, and runtime limits. The
[Decision models guide](https://docs.openclaw.ai/concepts/decision-models)
explains rubric definitions, score semantics, and the plugin API shared with
TypeSafe AI.
