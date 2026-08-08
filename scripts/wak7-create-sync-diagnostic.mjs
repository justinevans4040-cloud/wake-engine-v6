import fs from "node:fs";

const file = "scripts/route-ui-audit.mjs";
let source = fs.readFileSync(file, "utf8");
const before = `  await page.getByRole("button", { name: "Save Automation", exact: true }).click();
  await page.locator(".automations-panel").waitFor({ state: "visible", timeout: 10000 });
  await automationRow(page, details.name).waitFor({ state: "visible", timeout: 10000 });`;
const after = `  await page.getByRole("button", { name: "Save Automation", exact: true }).click();
  await page.locator(".automations-panel").waitFor({ state: "visible", timeout: 10000 });
  const stateAfterSave = await getState(page);
  const persistedRecord = (stateAfterSave.automations || []).find((item) => item.name === details.name);
  if (!persistedRecord) {
    const visibleState = await page.locator(".content-flow").innerText();
    throw new Error(\`Automation save returned to the list but did not persist \"\${details.name}\". Persisted names: \${(stateAfterSave.automations || []).map((item) => item.name).join(" | ")}. Visible state: \${visibleState}\`);
  }
  const savedRow = automationRow(page, details.name);
  if (!(await savedRow.isVisible({ timeout: 5000 }).catch(() => false))) {
    const panelText = await page.locator(".automations-panel").innerText();
    throw new Error(\`Automation \"\${details.name}\" persisted as \${persistedRecord.id} but the refreshed Automation list did not render it. Panel: \${panelText}\`);
  }`;
const first = source.indexOf(before);
if (first < 0) throw new Error("createAutomation save assertion block not found.");
if (source.indexOf(before, first + before.length) >= 0) throw new Error("createAutomation save assertion block is not unique.");
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(file, source, "utf8");
console.log("Automation create persistence/render diagnostics installed.");
