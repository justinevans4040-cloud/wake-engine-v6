import React from "react";
import { Camera, CircleCheck } from "lucide-react";
import { Panel, PanelTitle } from "../common/UIPrimitives.jsx";

export function AuditTab({ state, busy, saveSnapshot }) {
  return (
    <Panel>
      <PanelTitle icon={Camera} title="Snapshot / Audit Trail" />
      <div className="snapshot-box">
        <CircleCheck size={34} />
        <h2>
          {state?.runtime?.snapshots || 0} snapshots · {state?.runtime?.exports || 0} exports
        </h2>
        <p>
          Sources, generated outputs, exports, history, and snapshots are persistent files in Wake Engine local
          application data.
        </p>
        <button type="button" className="primary-action" disabled={busy} onClick={saveSnapshot}>
          Save Snapshot
        </button>
      </div>
    </Panel>
  );
}
