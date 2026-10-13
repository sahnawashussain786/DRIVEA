import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

const urls = ["http://localhost:5173/login", "http://localhost:5173/", "http://localhost:5173/register"];
for (const url of urls) {
  errors.length = 0;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  const title = await page.title();
  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\s+/g, " "));
  console.log(`\n== ${url} ==`);
  console.log("HTTP:", res?.status(), "| title:", title);
  console.log("body snippet:", bodySnippet);
  console.log("console errors:", errors.length ? errors : "none");
}

await browser.close();
