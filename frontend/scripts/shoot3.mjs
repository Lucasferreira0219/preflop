import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "C:/projects/preflop/frontend/.shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:8000";
const errors = [];
const browser = await chromium.launch();

async function run(mode, tag) {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1320 } });
  await ctx.addInitScript((m) => localStorage.setItem("preflop_mode", m), mode);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`[${tag}] ${m.text()}`));

  await page.goto(`${BASE}/sim`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Qual é a sua ação?", { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${tag}-question.png` });
  console.log(`shot ${tag}-question`);

  await page.locator('main button:has-text("Fold")').first().click();
  await page.waitForSelector("text=O que aprender", { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${tag}-result.png`, fullPage: true });
  console.log(`shot ${tag}-result`);
  await ctx.close();
}

try {
  await run("sng", "p1-sng");
  await run("mtt", "p2-mtt");
} catch (e) {
  console.log("FLOW ERROR:", e.message);
} finally {
  await browser.close();
}
console.log("\n=== ERRORS ===\n" + (errors.length ? errors.join("\n") : "none"));
