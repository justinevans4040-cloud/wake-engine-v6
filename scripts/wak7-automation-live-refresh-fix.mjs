import fs from "node:fs";

const file = "src/main.jsx";
let source = fs.readFileSync(file, "utf8");
const before = `  const automations = state?.automations || [];
  const runs = state?.automationRuns || [];
  const reviewQueue = state?.reviewQueue || [];

  const handleToggle = async (id, enabled) => {`;
const after = `  const automations = state?.automations || [];
  const runs = state?.automationRuns || [];
  const reviewQueue = state?.reviewQueue || [];

  useEffect(() => {
    let alive = true;
    const timer = window.setInterval(() => {
      if (!alive || busy || editor) return;
      Promise.resolve(onRefresh()).catch((error) => {
        if (alive) setOperationError(error.message);
      });
    }, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [busy, editor, onRefresh, setOperationError]);

  const handleToggle = async (id, enabled) => {`;
const first = source.indexOf(before);
if (first < 0) throw new Error("Automations live-refresh insertion point not found.");
if (source.indexOf(before, first + before.length) >= 0) throw new Error("Automations live-refresh insertion point is not unique.");
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(file, source, "utf8");
console.log("Automations now refreshes persisted scheduler state while the panel is idle.");
