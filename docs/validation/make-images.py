# python docs/validation/make-images.py <magic-dir> : builds img/sta-*.png (text) and img/layout-*.png (side by side) from the compare outputs
import sys, re
from PIL import Image, ImageDraw, ImageFont
f = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 13)
def text_pair(a, b, out, title, n=60):
    la, lb = open(a).read().splitlines()[:n], open(b).read().splitlines()[:n]
    W = 760; im = Image.new("RGB", (W * 2 + 30, 40 + 16 * n), "white"); d = ImageDraw.Draw(im)
    for x, t, L in ((8, "Native sta (container)", la), (W + 22, "Browser OpenSTA", lb)):
        d.text((x, 6), t, fill="blue", font=f)
        for i, l in enumerate(L): d.text((x, 28 + 16 * i), l[:105], fill="black", font=f)
    im.convert("P", palette=Image.ADAPTIVE, colors=16).save(out, optimize=True)
def sta(t, out):
    s = lambda p: "\n".join(l for l in open(p).read().splitlines() if l.strip())
    for k in ("native", "browser"): open(f"/tmp/{k}-{t}.txt", "w").write(s(f"docs/validation/logs/sta-{k}-{t}.txt").split("@@MAX")[1])
    text_pair(f"/tmp/native-{t}.txt", f"/tmp/browser-{t}.txt", out, t, 30)
def lay(d, out):
    a, b = Image.open(f"{d}/native.png").convert("RGB"), Image.open(f"{d}/browser.png").convert("RGB")
    im = Image.new("RGB", (a.width + b.width + 10, a.height + 30), "white"); dr = ImageDraw.Draw(im)
    dr.text((6, 6), "Native Magic -> GDS (KLayout view)", fill="blue", font=f); dr.text((a.width + 16, 6), "Browser Magic -> GDS (KLayout view)", fill="blue", font=f)
    im.paste(a, (0, 30)); im.paste(b, (a.width + 10, 30)); im.convert("P", palette=Image.ADAPTIVE, colors=64).save(out, optimize=True)
if __name__ == "__main__":
    m = sys.argv[1]
    sta("shreg4", "docs/validation/img/sta-shreg4.png"); sta("cnt8", "docs/validation/img/sta-cnt8.png")
    for d in ("adder2", "tiny8"): lay(f"{m}/{d}", f"docs/validation/img/layout-{d}.png")
