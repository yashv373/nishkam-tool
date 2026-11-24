# Count the stage chips Studio shows (#nav .stage) for each PDK, in Edge, with a fresh browser profile per PDK.
# Usage: python docs/validation/chips.py <outdir>   (needs `python -m http.server 8000` serving web/)
import sys, json
from playwright.sync_api import sync_playwright
out = sys.argv[1]; res = {}; errs = []
COUNT = "els => els.filter(e => e.offsetParent !== null).map(e => e.innerText.replace(/\\s+/g,' ').trim())"
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    for pdk in ["gf180mcuD", "sky130A", "ihp-sg13g2"]:
        pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:8000/studio.html?mock"); pg.wait_for_selector("#nav .stage", timeout=30000); pg.wait_for_timeout(1500)
        pg.select_option("#pdk", pdk); pg.wait_for_timeout(1500)
        names = pg.eval_on_selector_all("#nav .stage", COUNT)
        res[pdk] = {"default": len(names), "names": names}
        pg.screenshot(path=f"{out}/chips-{pdk}-default.png")
        # tick the five optional stages (CDC, Formal, Scan + ATPG, Gate-level sim, Equivalence check) in Properties
        pg.evaluate("""() => { for (const k of ["cdc","formal","dft","gls","lec"]) { const c = document.querySelector('#propsBody .fld[data-k="'+k+'"] input'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); } } }""")
        pg.wait_for_timeout(800)
        names2 = pg.eval_on_selector_all("#nav .stage", COUNT)
        res[pdk]["all_optional_ticked"] = len(names2); res[pdk]["names_all"] = names2
        pg.screenshot(path=f"{out}/chips-{pdk}-all-optional.png")
    res["console_errors"] = errs; b.close()
json.dump(res, open(out + "/chips.json", "w"), indent=1)
print(json.dumps({k: (v["default"], v["all_optional_ticked"]) if isinstance(v, dict) else len(v) for k, v in res.items()}))
