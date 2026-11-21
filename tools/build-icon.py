"""Render the Bible app icon at Windows icon sizes (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIZE = 1024
SCALE = SIZE / 256

def box(coords):
    return tuple(round(c * SCALE) for c in coords)

im = Image.new("RGBA", (SIZE, SIZE))
d = ImageDraw.Draw(im)
d.rounded_rectangle(box((35, 19, 223, 246)), radius=17*SCALE, fill="#27160f")
d.rounded_rectangle(box((49, 200, 220, 239)), radius=9*SCALE, fill="#f4e8ca")
for y in (221, 229):
    d.line(box((59, y, 211, y)), fill="#bfa77b", width=round(2*SCALE))

mask = Image.new("L", (SIZE, SIZE))
ImageDraw.Draw(mask).rounded_rectangle(box((33, 10, 223, 217)), radius=15*SCALE, fill=255)
gradient = Image.new("RGBA", (SIZE, SIZE))
pixels = gradient.load()
for y in range(SIZE):
    for x in range(SIZE):
        t = min(1, max(0, ((x / SCALE - 33) / 190 + (y / SCALE - 10) / 207) / 2))
        pixels[x, y] = tuple(round(a + (b-a)*t) for a, b in zip((133, 81, 50), (59, 32, 21))) + (255,)
im.paste(gradient, (0, 0), mask)
d = ImageDraw.Draw(im)
d.rounded_rectangle(box((33, 10, 223, 217)), radius=15*SCALE, outline="#bd934f", width=round(3*SCALE))
d.line(box((59, 12, 59, 214)), fill="#26170f", width=round(4*SCALE))
d.line(box((64, 13, 64, 212)), fill="#b98a46", width=round(2*SCALE))
d.rounded_rectangle(box((76, 30, 204, 195)), radius=5*SCALE, outline="#dfb75e", width=round(3*SCALE))
cross = [(131,64),(149,64),(149,94),(177,94),(177,111),(149,111),(149,155),(131,155),(131,111),(103,111),(103,94),(131,94)]
d.polygon([(round(x*SCALE), round(y*SCALE)) for x,y in cross], fill="#f0cd79")
d.polygon([(round(x*SCALE), round(y*SCALE)) for x,y in [(139,170),(145,176),(139,182),(133,176)]], fill="#dfb75e")
d.polygon([(round(x*SCALE), round(y*SCALE)) for x,y in [(180,215),(196,215),(196,253),(188,247),(180,253)]], fill="#a92e26")

output = ROOT / "assets"
output.mkdir(exist_ok=True)
icon = im.resize((256, 256), Image.Resampling.LANCZOS)
icon.save(output / "biblia.png")
icon.save(output / "biblia.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
print("Ícones gerados: assets/biblia.png e assets/biblia.ico")
