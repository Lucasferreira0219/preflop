import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "C:/projects/preflop/frontend/.shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:8000";

const errors = [];

function attach(page, tag) {
  page.on("pageerror", (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${tag}] console.error: ${m.text()}`);
  });
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot:", name);
}

const browser = await chromium.launch();

try {
  // 1) Launcher
  let page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  attach(page, "launcher");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, "1-launcher");
  await page.close();

  // 2) Simulador — pergunta
  page = await browser.newPage({ viewport: { width: 820, height: 1300 } });
  attach(page, "sim");
  await page.goto(`${BASE}/sim`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Qual é a sua ação?", { timeout: 8000 });
  await page.waitForTimeout(400);
  await shot(page, "2-sim-question");

  // 3) Resultado — clica Fold (sempre existe)
  await page.locator('button:has-text("Fold")').first().click();
  await page.waitForSelector("text=Análise da mão", { timeout: 8000 });
  await page.waitForTimeout(500);
  await shot(page, "3-sim-result");

  // 4) Joga mais algumas mãos pra alimentar a análise
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Space"); // próxima mão
    await page.waitForSelector("text=Qual é a sua ação?", { timeout: 8000 });
    const btns = page.locator('main button:has-text("Fold"), main button:has-text("Call"), main button:has-text("Abrir"), main button:has-text("3-Bet")');
    await btns.first().click();
    await page.waitForTimeout(250);
  }

  // 5) Análise
  await page.locator('[aria-label="Análise de desempenho"]').click();
  await page.waitForSelector("text=Análise de desempenho", { timeout: 8000 });
  await page.waitForTimeout(800);
  await shot(page, "4-sim-analytics");
  await page.close();

  // 6) Consulta
  page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
  attach(page, "consulta");
  await page.goto(`${BASE}/consulta`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Posição do herói", { timeout: 8000 });
  await page.locator('button:has-text("BTN")').first().click();
  await page.waitForTimeout(900);
  await shot(page, "5-consulta");
  await page.close();
} catch (e) {
  console.log("FLOW ERROR:", e.message);
} finally {
  await browser.close();
}

console.log("\n=== CONSOLE/PAGE ERRORS ===");
console.log(errors.length ? errors.join("\n") : "none");
