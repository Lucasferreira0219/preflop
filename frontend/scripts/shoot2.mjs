import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "C:/projects/preflop/frontend/.shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:8000";
const errors = [];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 820, height: 1320 } });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

  await page.goto(`${BASE}/sim`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Qual é a sua ação?", { timeout: 8000 });
  await page.waitForTimeout(400);

  // Tooltip de ação (hover no Fold)
  await page.locator('main button:has-text("Fold")').first().hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/d1-action-tooltip.png` });
  console.log("shot d1");

  // Resultado — modo estudo (default)
  await page.locator('main button:has-text("Fold")').first().click();
  await page.waitForSelector("text=O que aprender", { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/d2-result-study.png`, fullPage: true });
  console.log("shot d2");

  // Modo rápido
  await page.locator('button:has-text("Rápido")').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/d3-result-quick.png`, fullPage: true });
  console.log("shot d3");

  // Glossário
  await page.locator('[aria-label="Glossário"]').click();
  await page.waitForSelector('input[placeholder*="Buscar"]', { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/d4-glossary.png` });
  console.log("shot d4");

  await page.close();
} catch (e) {
  console.log("FLOW ERROR:", e.message);
} finally {
  await browser.close();
}
console.log("\n=== ERRORS ===\n" + (errors.length ? errors.join("\n") : "none"));
