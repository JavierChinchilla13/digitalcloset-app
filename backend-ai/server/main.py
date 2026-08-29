import io
import logging
import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("digital_closet_ai")

app = FastAPI(title="Digital Closet AI - Background Removal Service")

# Comma-separated allowed origins, matching the Java backend's CORS approach
# (SecurityConfig.java). Not a secret - override via env var in any deployed
# environment to point at the real frontend domain. allow_credentials stays
# False: the frontend calls this with a plain fetch() and no credentials
# (frontend/src/lib/background-removers/api.ts), and allow_credentials=True
# combined with a wildcard origin is invalid anyway.
ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Matches the Java backend's spring.servlet.multipart.max-file-size (10MB).
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


@app.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    # Reject anything that doesn't claim to be an image before doing any real
    # work - avoids handing arbitrary bytes to rembg/onnxruntime.
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="File must be an image")

    input_image = await file.read()

    if len(input_image) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 10MB size limit")

    if len(input_image) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        output_image = remove(input_image)
    except Exception as e:
        # Log the real error server-side, but never return raw exception text
        # to the client - it could contain internal detail (paths, library
        # internals) that shouldn't be exposed over the API.
        logger.error("Error processing image: %s", e)
        raise HTTPException(status_code=500, detail="Failed to process image")

    output_buffer = io.BytesIO(output_image)

    return StreamingResponse(
        output_buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename=processed_{file.filename}.png"}
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
