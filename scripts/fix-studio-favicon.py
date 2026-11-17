"""Rebuild browser favicons with genuine alpha (Pillow required).
Touch/maskable install icons intentionally retain an opaque OS-friendly canvas.
"""
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
image=Image.open(root/'hub/app-icons/icon-512.png').convert('RGBA')
# Keep the original lettering; rebuild the rounded silhouette without its white matte.
base=Image.new('RGBA',image.size,(49,95,79,255))
base.paste(image.crop((48,100,464,410)),(48,100))
mask=Image.new('L',(2048,2048));ImageDraw.Draw(mask).rounded_rectangle((0,0,2047,2047),radius=240,fill=255)
base.putalpha(mask.resize(base.size,Image.Resampling.LANCZOS))
base.resize((32,32),Image.Resampling.LANCZOS).save(root/'hub/app-icons/favicon-32.png')
base.save(root/'hub/app-icons/favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])
