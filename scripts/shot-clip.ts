// npx tsx scripts/shot-clip.ts url out.png width y height
import { chromium } from "playwright";
(async () => {
  const [url, out, w, y, h] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(w), height: 900 }, isMobile: Number(w) < 800, hasTouch: Number(w) < 800 });
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-visible")));
  await p.waitForTimeout(900);
  await p.screenshot({ path: out, fullPage: true, clip: { x: 0, y: Number(y), width: Number(w), height: Number(h) } });
  await b.close();
})();
