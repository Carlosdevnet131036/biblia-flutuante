"""Gera o ícone da Tela de Início do iPhone (quadrado cheio, sem transparência). Requer Pillow."""
from pathlib import Path
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
S = 1024
FONT = Path("C:/Windows/Fonts/georgiab.ttf")

# Capa de couro: gradiente diagonal + brilho suave + textura fina.
im = Image.new("RGB", (S, S))
px = im.load()
a, b = (133, 81, 50), (45, 23, 13)
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        px[x, y] = tuple(round(p + (q - p) * t) for p, q in zip(a, b))
glow = Image.new("L", (S, S))
ImageDraw.Draw(glow).ellipse((-150, -250, 650, 450), fill=70)
glow = glow.filter(ImageFilter.GaussianBlur(160))
im = Image.composite(Image.new("RGB", (S, S), (190, 130, 90)), im, glow)
rnd = random.Random(7)
noise = Image.new("L", (S, S))
npx = noise.load()
for y in range(S):
    for x in range(S):
        npx[x, y] = rnd.randint(0, 18)
im = Image.composite(Image.new("RGB", (S, S), (20, 10, 5)), im, noise)

d = ImageDraw.Draw(im)
GOLD, GOLD_DK = (223, 183, 94), (169, 119, 39)
# Moldura dourada dupla, arredondada como os cantos do ícone no iPhone.
d.rounded_rectangle((64, 64, S - 64, S - 64), radius=170, outline=GOLD, width=10)
d.rounded_rectangle((94, 94, S - 94, S - 94), radius=145, outline=GOLD_DK, width=4)

# Cruz com leve sombra.
def cross(dx=0, dy=0):
    w, top, bar, bottom, arm = 66, 190, 330, 600, 150
    c = S // 2
    return [(c - w // 2 + dx, top + dy), (c + w // 2 + dx, top + dy), (c + w // 2 + dx, bar + dy),
            (c + w // 2 + arm + dx, bar + dy), (c + w // 2 + arm + dx, bar + w + dy), (c + w // 2 + dx, bar + w + dy),
            (c + w // 2 + dx, bottom + dy), (c - w // 2 + dx, bottom + dy), (c - w // 2 + dx, bar + w + dy),
            (c - w // 2 - arm + dx, bar + w + dy), (c - w // 2 - arm + dx, bar + dy), (c - w // 2 + dx, bar + dy)]
shadow = Image.new("L", (S, S))
ImageDraw.Draw(shadow).polygon(cross(8, 12), fill=150)
im = Image.composite(Image.new("RGB", (S, S), (20, 8, 3)), im, shadow.filter(ImageFilter.GaussianBlur(10)))
grad = Image.new("RGB", (S, S))
gp = grad.load()
for y in range(S):
    for x in range(S):
        t = min(1, max(0, (x + y - 600) / 900))
        gp[x, y] = tuple(round(p + (q - p) * t) for p, q in zip((255, 240, 174), GOLD_DK))
mask = Image.new("L", (S, S))
ImageDraw.Draw(mask).polygon(cross(), fill=255)
im.paste(grad, (0, 0), mask)

# Título.
d = ImageDraw.Draw(im)
font = ImageFont.truetype(str(FONT), 150)
text = "BÍBLIA"
x0, y0, x1, y1 = d.textbbox((0, 0), text, font=font)
tx, ty = (S - (x1 - x0)) // 2 - x0, 680 - y0
d.text((tx + 4, ty + 6), text, font=font, fill=(25, 10, 4))
d.text((tx, ty), text, font=font, fill=GOLD)
small = ImageFont.truetype(str(FONT), 46)
d.text((S // 2, 885), "SAGRADA", font=small, fill=GOLD_DK, anchor="mm")

out = ROOT / "assets"
im.resize((180, 180), Image.Resampling.LANCZOS).save(out / "apple-touch-icon.png")
im.resize((512, 512), Image.Resampling.LANCZOS).save(out / "icon-512.png")
im.resize((192, 192), Image.Resampling.LANCZOS).save(out / "icon-192.png")
print("Ícones gerados: apple-touch-icon.png, icon-192.png, icon-512.png")
