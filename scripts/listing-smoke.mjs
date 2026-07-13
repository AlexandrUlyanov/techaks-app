import { chromium } from "playwright";

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const categorySlug = process.env.E2E_CATEGORY_SLUG || "kuhonnye-vesy";
const searchQuery = process.env.E2E_SEARCH_QUERY || "кабель";

const scenarios = [
  { name: "category", path: `/catalog?cat=${categorySlug}` },
  {
    name: "category single filter",
    path: `/catalog?cat=${categorySlug}&filter=tip%3Avesy-kuhonnye`,
  },
  {
    name: "category multi filter",
    path: `/catalog?cat=${categorySlug}&filter=tip%3Avesy-kuhonnye&filter=cvet%3Abelyy`,
  },
  { name: "brands", path: "/catalog?view=brands" },
  { name: "promotions", path: "/promotions" },
  { name: "search", path: `/search?q=${encodeURIComponent(searchQuery)}` },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertHealthyPage(page, scenario) {
  const response = await page.goto(`${baseUrl}${scenario.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  assert(response?.ok(), `${scenario.name}: HTTP ${response?.status() ?? "no response"}`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const bodyText = (await page.locator("body").innerText()).trim();
  assert(bodyText.length > 100, `${scenario.name}: page looks blank`);
  assert(!/application error|something went wrong|белый экран/i.test(bodyText), `${scenario.name}: error fallback is visible`);
  assert(await page.locator("main, h1, [data-slot='sheet-content']").count(), `${scenario.name}: primary content is missing`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  for (const scenario of scenarios) {
    await assertHealthyPage(page, scenario);
    process.stdout.write(`✓ ${scenario.name}\n`);
  }

  await page.goto(`${baseUrl}/search?q=${encodeURIComponent(searchQuery)}&priceTo=500`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  const priceChip = page.getByText(/^Цена:/).first();
  await priceChip.waitFor({ state: "visible", timeout: 15_000 });
  const priceThumbs = page.locator("[data-slot='slider-thumb']");
  assert((await priceThumbs.count()) >= 2, "search price filter: range thumbs are missing");
  const upperMax = Number(await priceThumbs.nth(1).getAttribute("aria-valuemax"));
  assert(upperMax > 500, `search price filter: upper bound collapsed to ${upperMax}`);
  process.stdout.write("✓ search price filter keeps the original upper bound\n");

  await page.goto(`${baseUrl}/catalog?cat=${categorySlug}&priceFrom=250&priceTo=0`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  const catalogText = await page.locator("body").innerText();
  assert(!/Цена:\s*250\s*₽\s*-\s*0\s*₽/i.test(catalogText), "catalog rendered an inverted 250-0 range");
  process.stdout.write("✓ catalog rejects an inverted price range\n");

  const productLink = page.locator("a[href^='/product/']").first();
  if (await productLink.count()) {
    await Promise.all([
      page.waitForURL(/\/product\//, { timeout: 20_000 }),
      productLink.click(),
    ]);
    assert((await page.locator("body").innerText()).length > 100, "product transition ended on a blank page");
    process.stdout.write("✓ listing to product transition\n");
  }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const mobilePage = await mobile.newPage();
  await assertHealthyPage(mobilePage, { name: "mobile dark catalog", path: `/catalog?cat=${categorySlug}` });
  process.stdout.write("✓ mobile dark catalog\n");
  await mobile.close();

  assert(pageErrors.length === 0, `browser page errors: ${pageErrors.join(" | ")}`);
} finally {
  await context.close();
  await browser.close();
}
