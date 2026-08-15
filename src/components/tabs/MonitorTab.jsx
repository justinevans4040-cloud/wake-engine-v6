import React from "react";
import {
  Activity,
  Camera,
  CircleAlert,
  Cpu,
  Database,
  Download,
  Filter,
  Gauge,
  HardDrive,
  Hexagon,
  Info,
  ListChecks,
  MemoryStick
} from "lucide-react";
import { Pill, Panel, PanelTitle, MonitorTile, Sparkline, metricValue } from "../common/UIPrimitives.jsx";
import { statusTone } from "../../app-config.jsx";

export function MonitorTab({
  system,
  systemHistory,
  openMonitorCard,
  setModal,
  openFolder,
  taskSearch,
  setTaskSearch,
  taskFilter,
  setTaskFilter,
  taskCounts,
  filteredTasks,
  openTaskCard,
  state,
  openCapabilityCard
}) {
  return (
    <>
      <Panel className="monitor-panel">
        <PanelTitle
          icon={Activity}
          title="System Monitor"
          right={
            <button
              type="button"
              className="panel-icon-action"
              aria-label="System monitor info"
              onClick={() =>
                openMonitorCard(
                  "System Monitor",
                  "Live local telemetry for CPU, RAM, GPU, runtime port, process uptime, and recent action logs. Click any tile or trace for the exact value behind it."
                )
              }
            >
              <Info size={18} />
            </button>
          }
        />
        <div className="monitor-grid">
          <MonitorTile
            icon={Cpu}
            label="CPU"
            value={metricValue(system?.cpu?.percent)}
            detail={system?.cpu ? `${system.cpu.cores} cores` : "sampling"}
            onClick={() =>
              openMonitorCard(
                "CPU",
                system?.cpu ? `Current CPU: ${system.cpu.percent}%\nCores: ${system.cpu.cores}` : "CPU telemetry is still sampling."
              )
            }
          />
          <MonitorTile
            icon={MemoryStick}
            label="RAM"
            value={metricValue(system?.memory?.percent)}
            detail={system?.memory ? `${system.memory.usedGb}/${system.memory.totalGb} GB` : "sampling"}
            onClick={() =>
              openMonitorCard(
                "RAM",
                system?.memory
                  ? `Current RAM: ${system.memory.percent}%\nUsed: ${system.memory.usedGb} GB\nTotal: ${system.memory.totalGb} GB`
                  : "RAM telemetry is still sampling."
              )
            }
          />
          <MonitorTile
            icon={Gauge}
            label="GPU"
            value={metricValue(system?.gpu?.utilization)}
            detail={system?.gpu?.name || "sampling"}
            tone={system?.gpu?.status === "unavailable" ? "warn" : "live"}
            onClick={() =>
              openMonitorCard(
                "GPU",
                system?.gpu
                  ? `Current GPU: ${metricValue(system.gpu.utilization)}\nName: ${system.gpu.name || "unknown"}\nStatus: ${system.gpu.status || "sampling"}`
                  : "GPU telemetry is still sampling."
              )
            }
          />
          <MonitorTile
            icon={HardDrive}
            label="Runtime"
            value={system?.runtime ? `:${system.runtime.port}` : ":8786"}
            detail={system?.runtime ? `PID ${system.runtime.pid}` : "local"}
            onClick={() =>
              openMonitorCard(
                "Runtime",
                system?.runtime
                  ? `Local runtime port: ${system.runtime.port}\nPID: ${system.runtime.pid}\nUptime: ${system.runtime.uptime || "sampling"}`
                  : "Runtime telemetry is still sampling."
              )
            }
          />
        </div>
        <div className="telemetry-grid">
          <Sparkline
            label="CPU Trace"
            values={(systemHistory || []).map((item) => item.cpu?.percent || 0)}
            onClick={() =>
              openMonitorCard(
                "CPU Trace",
                `${(systemHistory || []).length} samples retained in this session.\nLatest: ${metricValue(system?.cpu?.percent)}`
              )
            }
          />
          <Sparkline
            label="RAM Trace"
            values={(systemHistory || []).map((item) => item.memory?.percent || 0)}
            tone="green"
            onClick={() =>
              openMonitorCard(
                "RAM Trace",
                `${(systemHistory || []).length} samples retained in this session.\nLatest: ${metricValue(system?.memory?.percent)}`
              )
            }
          />
          <Sparkline
            label="GPU Trace"
            values={(systemHistory || []).map((item) => item.gpu?.utilization || 0)}
            tone="ember"
            onClick={() =>
              openMonitorCard(
                "GPU Trace",
                `${(systemHistory || []).length} samples retained in this session.\nLatest: ${metricValue(system?.gpu?.utilization)}`
              )
            }
          />
        </div>
        <div className="log-strip">
          {(system?.logs || []).slice(0, 4).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() =>
                setModal({
                  title: entry.level.toUpperCase(),
                  body: `${entry.message}\n${new Date(entry.createdAt).toLocaleString()}`
                })
              }
            >
              <span className={`log-dot ${entry.level}`} />
              <strong>{entry.message}</strong>
              <small>{new Date(entry.createdAt).toLocaleTimeString()}</small>
            </button>
          ))}
        </div>
        <div className="desktop-actions">
          <button type="button" onClick={() => openFolder("exports")}>
            <Download size={16} /> Open Exports
          </button>
          <button type="button" onClick={() => openFolder("snapshots")}>
            <Camera size={16} /> Open Snapshots
          </button>
          <button type="button" onClick={() => openFolder("data")}>
            <Database size={16} /> Open Data
          </button>
        </div>
      </Panel>

      <div className="lower-grid">
        <Panel>
          <PanelTitle
            icon={ListChecks}
            title="Task Monitor"
            right={
              <button
                type="button"
                className="panel-icon-action"
                aria-label="Task monitor filter info"
                onClick={() =>
                  openMonitorCard(
                    "Task Monitor Filters",
                    "Use All, Running, or Done to narrow the task list. Click any task row to get its detail and jump to the related Wake Engine surface."
                  )
                }
              >
                <Filter size={18} />
              </button>
            }
          />
          <input
            className="task-search"
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Search tasks..."
          />
          <div className="filter-row">
            {["all", "running", "done"].map((filter) => (
              <button
                key={filter}
                type="button"
                className={taskFilter === filter ? "active-filter" : ""}
                onClick={() => setTaskFilter(filter)}
              >
                {filter}
                <span>{taskCounts[filter] || 0}</span>
              </button>
            ))}
          </div>
          <div className="task-list">
            {filteredTasks.map((task) => (
              <button key={task.id} type="button" className="task-row" onClick={() => openTaskCard(task)}>
                <span className={`task-light ${statusTone[task.status] || task.status}`} />
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.status}</small>
                </span>
                <em>{task.updated}</em>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelTitle
            icon={Hexagon}
            title="Capability Truth Map"
            right={
              <button
                type="button"
                className="panel-icon-action"
                aria-label="Capability truth map info"
                onClick={() =>
                  openMonitorCard(
                    "Capability Truth Map",
                    "Every row is tied to local runtime evidence. Click a capability to see status, evidence, and a jump button to the section or agent it represents."
                  )
                }
              >
                <CircleAlert size={18} />
              </button>
            }
          />
          <div className="capability-list">
            {(state.capabilities || []).map((capability) => (
              <button key={capability.id} type="button" onClick={() => openCapabilityCard(capability)}>
                <span className={`task-light ${statusTone[capability.status]}`} />
                <span>
                  <strong>{capability.label}</strong>
                  <small>{capability.detail}</small>
                </span>
                <Pill tone={capability.status}>{capability.status}</Pill>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
