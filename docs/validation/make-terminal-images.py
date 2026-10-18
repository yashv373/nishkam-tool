# python docs/validation/make-terminal-images.py : renders the stored logs, unedited, as terminal-style PNGs in img/term-*.png
# Each block is "$ <where it came from>" followed by the last N lines (or all lines) of the real log file.
from PIL import Image, ImageDraw, ImageFont
import os
L = "docs/validation/logs/"; f = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 14)
def shot(out, blocks, width=112):
    rows = []
    for title, path, tail in blocks:
        lines = open(L + path, encoding="utf-8-sig").read().splitlines()
        if tail < 0:  # evidence lines only, from the last 12 lines; "..." where lines are skipped
            import re
            last = lines[-12:]; lines = []
            for i, l in enumerate(last):
                if re.search(r"Circuit . contains|Final result|Circuits match", l): lines.append(l)
                elif lines and lines[-1] != "...": lines.append("...")
            while lines and lines[-1] == "...": lines.pop()
        elif tail: lines = lines[-tail:]
        rows.append(("$ " + title, "cmd")); rows += [(l[:width], "out") for l in lines]; rows.append(("", "out"))
    im = Image.new("RGB", (int(width * 8.2) + 24, 18 * len(rows) + 20), (24, 24, 28)); d = ImageDraw.Draw(im)
    for i, (t, k) in enumerate(rows): d.text((12, 10 + 18 * i), t, fill=(120, 200, 255) if k == "cmd" else (225, 225, 225), font=f)
    im.convert("P", palette=Image.ADAPTIVE, colors=16).save("docs/validation/img/" + out, optimize=True)
shot("term-cts.png", [("node web/studio/engines/cts.selftest.mjs   (browser build)", "cts.txt", 0), ("node docs/validation/ctsdiff.mjs   (browser DEF vs native OpenROAD DEF)", "ctsdiff.txt", 0)])
shot("term-lvs-browser.png", [(f"browser Netgen, {d}", f"netgen-browser-{d}.txt", 0) for d in ("adder2", "mult8", "tiny8")] + [("node web/studio/engines/lvs.selftest.mjs", "lvs.txt", 0)])
shot("term-lvs-native.png", [(f"native netgen -batch source run.tcl, {d}  (device and net counts, verdict)", f"netgen-native-{d}.log", -1) for d in ("adder2", "mult8", "tiny8")])
shot("term-drc.png", [("qrouter before/after, Magic DRC (docs/validation/drc-count.mjs)", "drc.txt", 0)])
shot("term-magic.png", [(f"browser Magic, {d}", f"magic-browser-{d}.txt", 0) for d in ("adder2", "tiny8")] + [(f"native Magic, {d}  (last 4 lines)", f"magic-native-{d}.txt", 4) for d in ("adder2", "tiny8")])
shot("term-opensta.png", [("node web/studio/engines/opensta.selftest.mjs", "opensta.txt", 0)], 150)
