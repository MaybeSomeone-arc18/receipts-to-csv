import { PaddleOCR } from "@paddleocr/paddleocr-js";
// The OCR runs in a worker that we can throw away to free memory (see public/ocr.js).
export async function create(){
  const base=new URL("vendor/",location.href);
  return PaddleOCR.create({
    textDetectionModelName:"PP-OCRv5_mobile_det",textDetectionModelAsset:{url:new URL("models/PP-OCRv5_mobile_det.tar",base).href},
    textRecognitionModelName:"PP-OCRv5_mobile_rec",textRecognitionModelAsset:{url:new URL("models/PP-OCRv5_mobile_rec.tar",base).href},
    ortOptions:{backend:"wasm",wasmPaths:new URL("ort/",base).href}});
}
