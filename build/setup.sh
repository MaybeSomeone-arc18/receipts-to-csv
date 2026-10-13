#!/bin/bash
# Builds the PaddleOCR (Apache-2.0) browser bundle and fetches the two PP-OCRv5 mobile models (one-time download; images never leave the computer).
set -e
cd "$(dirname "$0")/.."
mkdir -p public/vendor/models public/vendor/ort
npx esbuild build/entry.js --bundle --format=esm --outfile=public/vendor/paddle.js --external:fs --external:path --external:crypto --external:worker_threads
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.* public/vendor/ort/
for m in PP-OCRv5_mobile_det PP-OCRv5_mobile_rec; do
  [ -s public/vendor/models/$m.tar ] || curl -fsSL -o public/vendor/models/$m.tar https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/${m}_onnx_infer.tar
done
