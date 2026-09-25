import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log(`[${m.type()}]`, m.text().slice(0, 600)));
  p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 600)));
  for (const u of process.argv.slice(2)) { console.log("==", u); await p.goto(u, { waitUntil: "networkidle" }); await p.waitForTimeout(1500); }
  await b.close();
})();
