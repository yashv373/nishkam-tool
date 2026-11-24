# Drives Microsoft Edge (Playwright) on Studio ?mock: seeds a project, ticks Scan + ATPG, runs it, clicks "Run chain test (early)".
# Usage: python edge-run.py <repo> <port> <out.json>
import sys, json, subprocess, time, pathlib
from playwright.sync_api import sync_playwright
repo, port, out = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
srv = subprocess.Popen([sys.executable, "-m", "http.server", port, "--bind", "127.0.0.1"], cwd=repo / "web", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
res = {"url": f"http://127.0.0.1:{port}/studio.html?mock", "runs": []}
try:
  with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    res["browser"] = b.version
    for key in (sys.argv[4].split(",") if len(sys.argv) > 4 else ["counter", "acc", "s27", "s298", "s344", "c17"]):
      pg = b.new_page(viewport={"width": 1440, "height": 900})
      errs = []; pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
      pg.goto(res["url"])
      src = (repo / f"docs/validation/dft/designs/{key}.v").read_text()
      pg.evaluate("""([k,s])=>{localStorage.clear();localStorage.setItem('studio:project:v1:seedcleared','1');
        localStorage.setItem('studio:project:v1',JSON.stringify({name:k,files:{[k+'.v']:s}}));
        localStorage.setItem('studio:opts',JSON.stringify({dft:true,top:k}));}""", [key, src])
      pg.reload(); pg.wait_for_function("window.__studio")
      t0 = time.time()
      pg.evaluate("window.__studio.start(window.__studio.plan('one','dft'))")
      r = {"key": key}
      try:
        pg.wait_for_function("document.body.innerText.includes('Scan + ATPG (early) passed')", timeout=120000)
        r["dftMs"] = int((time.time() - t0) * 1000)   # click to "passed" in the Console
        if pg.get_by_text("Skip", exact=True).count(): pg.get_by_text("Skip", exact=True).first.click()
        pg.locator("text=Scan + ATPG (e").first.click()
        pg.wait_for_function("document.body.innerText.includes('Fault coverage')", timeout=60000)
        txt = pg.inner_text("body"); i = txt.find("Fault coverage"); r["headText"] = txt[i:i+400]
        btn = pg.get_by_text("Run chain test (early)")
        if btn.count():
          t1 = time.time(); btn.first.click()
          pg.wait_for_function("/Chain test (passed|failed)/.test(document.body.innerText)", timeout=60000)
          r["chainTestMs"] = int((time.time() - t1) * 1000)
          t = pg.inner_text("body"); j = t.find("Chain test"); r["chainTestText"] = t[j:j+120]
        else: r["chainTestText"] = "no button (no flops or no clock)"
      except Exception as e: r["error"] = str(e)[:200]; r["bodyTail"] = pg.inner_text("body")[-300:]
      pg.screenshot(path=out.replace(".json", "-" + key + ".png")); r["consoleErrors"] = errs; res["runs"].append(r); pg.close(); print(key, {k: v for k, v in r.items() if k in ("dftMs","chainTestText","error")}, flush=True)
    b.close()
finally: srv.terminate()
json.dump(res, open(out, "w"), indent=1)
