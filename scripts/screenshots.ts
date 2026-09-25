/**
 * Screenshots + verificação de overflow horizontal em várias larguras.
 *   npx tsx scripts/screenshots.ts [baseUrl] [outDir] [paths...]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
const paths = process.argv.slice(4).length ? process.argv.slice(4) : ["/", "/produto/montez-m6", "/kits", "/checkout"];
const widths = (process.env.WIDTHS ?? "390,1440").split(",").map(Number);

(async () => {
  const browser = await chromium.launch();
  let problems = 0;
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800 });
    const page = await ctx.newPage();
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        // força as animações de entrada a aparecerem no screenshot
        document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
        await new Promise((r) => setTimeout(r, 900));
      });
      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const offenders: string[] = [];
        document.querySelectorAll("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (r.right > vw + 1 && style.position !== "fixed" && r.width > 0 && !el.closest(".overflow-x-auto,.overflow-hidden,[aria-roledescription]")) {
            offenders.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() ?? "").slice(0, 60)} → ${Math.round(r.right)}px`);
          }
        });
        return { scroll: document.documentElement.scrollWidth > vw, offenders: offenders.slice(0, 5) };
      });
      if (overflow.scroll || overflow.offenders.length) {
        problems++;
        console.log(`⚠ ${w}px ${p}: overflow`, overflow.offenders);
      } else console.log(`✔ ${w}px ${p}: sem scroll horizontal`);
      const name = `${out}/${w}${p.replace(/[/?=&]/g, "_") || "_home"}.png`;
      await page.screenshot({ path: name, fullPage: true });
    }
    await ctx.close();
  }
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
