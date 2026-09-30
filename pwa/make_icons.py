# 앱 아이콘 만들기: python pwa/make_icons.py  → public/icons/*.png
# 어두운 자두색 바탕 위에 로즈·골드 두 반지가 서로 맞물린 모양 (사이트 로고와 같은 구성)
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'public' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)
SS = 4  # 4배로 그린 뒤 줄여 가장자리를 부드럽게
ROSE = (235, 151, 167)
GOLD = (220, 181, 119)


def background(size: int) -> Image.Image:
    top = (46, 28, 36)
    bottom = (20, 14, 18)
    img = Image.new('RGB', (size, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    # 가운데 위쪽 은은한 빛 (가장자리 없이 부드럽게 사라지는 원형 그라데이션)
    g = ImageChops.invert(Image.radial_gradient('L'))  # 가운데 255 → 바깥 0
    g = g.point(lambda v: round((v / 255) ** 2.2 * 95))
    gs = round(size * 1.25)
    g = g.resize((gs, gs), Image.BICUBIC)
    mask = Image.new('L', (size, size), 0)
    mask.paste(g, (round(size / 2 - gs / 2), round(size * 0.42 - gs / 2)))
    light = Image.new('RGB', (size, size), (132, 58, 84))
    return Image.composite(light, img, mask)


def rings(img: Image.Image, scale: float) -> None:
    """scale: 반지 한 쌍이 차지하는 폭 (아이콘 크기 대비)"""
    size = img.width
    d = ImageDraw.Draw(img)
    r = size * scale / 3.2
    w = max(2, round(size * scale * 0.085))
    cy = size / 2
    rose_c = size / 2 - r * 0.6
    gold_c = size / 2 + r * 0.6
    box = lambda cx: [cx - r, cy - r, cx + r, cy + r]
    d.ellipse(box(rose_c), outline=ROSE, width=w)
    d.ellipse(box(gold_c), outline=GOLD, width=w)
    # 아래쪽 교차점에서는 로즈 반지가 골드 반지 위로 지나가게 해 맞물린 모양으로
    a = math.degrees(math.atan2(0.8, 0.6))
    d.arc(box(rose_c), a - 22, a + 22, fill=ROSE, width=w)


def make(size: int, scale: float, name: str) -> None:
    big = background(size * SS)
    rings(big, scale)
    big.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print(name, size)


make(192, 0.66, 'icon-192.png')
make(512, 0.66, 'icon-512.png')
# 마스커블: 가운데 원(지름 80%) 안에 들어가도록 더 작게
make(512, 0.5, 'icon-maskable-512.png')
make(180, 0.62, 'apple-touch-icon.png')
