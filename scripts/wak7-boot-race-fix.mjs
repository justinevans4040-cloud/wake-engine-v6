import fs from "node:fs";

const file = "scripts/route-ui-audit.mjs";
let source = fs.readFileSync(file, "utf8");
const before = `  if (await page.locator(".boot").isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole("button", { name: /Skip Boot/i }).click({ timeout: 3000 });
  }
  await appShell.waitFor({ state: "visible", timeout: 20000 });`;
const after = `  const boot = page.locator(".boot");
  if (await boot.isVisible({ timeout: 3000 }).catch(() => false)) {
    try {
      await page.getByRole("button", { name: /Skip Boot/i }).click({ timeout: 3000 });
    } catch (error) {
      const bootStillVisible = await boot.isVisible({ timeout: 500 }).catch(() => false);
      if (bootStillVisible) throw error;
    }
  }
  await appShell.waitFor({ state: "visible", timeout: 20000 });`;
const first = source.indexOf(before);
if (first < 0) throw new Error("Boot race target not found.");
if (source.indexOf(before, first + before.length) >= 0) throw new Error("Boot race target is not unique.");
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(file, source, "utf8");
console.log("Route UI audit now tolerates the boot overlay disappearing between visibility check and click.");
