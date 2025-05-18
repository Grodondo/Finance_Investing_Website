import os
import uuid
import shutil
from fastapi import UploadFile, HTTPException
from PIL import Image
import io
from typing import Tuple, List

# Allowed mime types for security
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
MAX_IMAGE_SIZE_MB = 10  # Max file size in MB

# Path to store images
UPLOAD_PATH = "uploads/forum"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_PATH, exist_ok=True)


def validate_image(file: UploadFile) -> Tuple[bytes, str]:
    """Validate image file type and size"""
    # Validate file type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}"
        )
    
    # Get file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file extension. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file into memory
    content = file.file.read()
    
    # Check file size
    file_size = len(content)
    max_size_bytes = MAX_IMAGE_SIZE_MB * 1024 * 1024
    
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=400, 
            detail=f"File size exceeds maximum allowed size of {MAX_IMAGE_SIZE_MB}MB"
        )
    
    return content, ext


def compress_image(content: bytes, quality: int = 85) -> bytes:
    """Compress image to reduce file size"""
    try:
        # Open image from memory
        img = Image.open(io.BytesIO(content))
        
        # Create output buffer
        output = io.BytesIO()
        
        # Determine format based on original image
        img_format = img.format if img.format else "JPEG"
        
        # Convert mode if needed
        if img.mode in ("RGBA", "P") and img_format == "JPEG":
            img = img.convert("RGB")
            
        # Save with compression
        img.save(output, format=img_format, optimize=True, quality=quality)
        
        # Get compressed bytes
        output.seek(0)
        return output.getvalue()
    except Exception as e:
        # If compression fails, return original image
        return content


async def save_image(file: UploadFile) -> Tuple[str, str, int, str]:
    """Save image file and return path, filename, size, and mime type"""
    content, ext = validate_image(file)
    
    # Compress image if it's a compatible format
    if file.content_type in ["image/jpeg", "image/png"]:
        content = compress_image(content)
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_PATH, unique_filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return details
    return (
        file_path,
        unique_filename,
        len(content),
        file.content_type
    )


async def delete_image(filepath: str) -> bool:
    """Delete image file"""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
    except Exception:
        return False


async def save_multiple_images(files: List[UploadFile]) -> List[Tuple[str, str, int, str]]:
    """Save multiple images and return their details"""
    results = []
    for file in files:
        result = await save_image(file)
        results.append(result)
    return results 