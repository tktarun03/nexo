"""Build PWA icons from the brand artwork in brand/.

brand/app-icon.png  - square app icon on a white page (rounded green tile)
brand/logo.png      - wordmark lock-up on white

Run: python3 scripts/make-icons.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "app-icon.png"
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
DEEP = (6, 46, 26)  # matches the dark green of the tile


def tile():
    im = Image.open(SRC).convert("RGB")
    # bounding box of the non-white tile
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r < 235 or g < 235 or b < 235:
                xs.append(x)
                ys.append(y)
    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    im = im.crop(box)
    # paint the white rounded corners deep green so OS masks never show white
    for seed in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
        ImageDraw.floodfill(im, seed, DEEP, thresh=60)
    side = max(im.size)
    sq = Image.new("RGB", (side, side), DEEP)
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return sq


def main():
    base = tile()
    for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
        base.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    # maskable: art inside the 80% safe zone
    m = Image.new("RGB", (512, 512), DEEP)
    inner = base.resize((420, 420), Image.LANCZOS)
    m.paste(inner, (46, 46))
    m.save(OUT / "maskable-512.png", optimize=True)
    # favicon.ico
    base.resize((48, 48), Image.LANCZOS).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
