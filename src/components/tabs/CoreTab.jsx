import React, { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, Database, Gauge, MemoryStick, Radio, Zap } from "lucide-react";
import { api } from "../../api.js";

function finitePercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function metric(value) {
  const number = finitePercent(value);
  return number === null ? "sampling" : `${Math.round(number)}%`;
}

function satellitePosition(index, total) {
  const count = Math.max(total, 1);
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const radius = 41;
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`
  };
}

export function WakeDarkMatterCore({ state, setModal }) {
  const [system, setSystem] = useState(null);
  const [systemError, setSystemError] = useState("");
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshSystem() {
      try {
        const fresh = await api("/system");
        if (!alive) return;
        setSystem(fresh);
        setSystemError("");
        setPulse((value) => value + 1);
      } catch (error) {
        if (!alive) return;
        setSystemError(error?.message || "System telemetry unavailable");
      }
    }

    refreshSystem();
    const timer = window.setInterval(refreshSystem, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const cpu = finitePercent(system?.cpu?.percent);
  const memory = finitePercent(system?.memory?.percent);
  const gpu = finitePercent(system?.gpu?.utilization);
  const availableMetrics = [cpu, memory, gpu].filter((value) => value !== null);
  const activity = availableMetrics.length
    ? Math.round(availableMetrics.reduce((sum, value) => sum + value, 0) / availableMetrics.length)
    : 0;

  const capabilities = useMemo(
    () => (state?.capabilities || []).filter((item) => item && item.label).slice(0, 8),
    [state?.capabilities]
  );
  const tasks = useMemo(() => (state?.tasks || []).filter(Boolean), [state?.tasks]);
  const runningTasks = tasks.filter((task) => ["running", "active", "working"].includes(String(task.status).toLowerCase()));
  const completedTasks = tasks.filter((task) => ["done", "complete", "completed"].includes(String(task.status).toLowerCase()));
  const runtimeOnline = Boolean(system?.runtime?.pid || system?.runtime?.port);

  const coreStyle = {
    "--wake-intensity": Math.max(0.18, activity / 100),
    "--wake-activity": `${activity}%`
  };

  function openCoreStatus() {
    setModal?.({
      title: "WAKE Dark Matter Core",
      body: [
        `Runtime: ${runtimeOnline ? "online" : systemError ? "telemetry unavailable" : "sampling"}`,
        `CPU: ${metric(cpu)}`,
        `RAM: ${metric(memory)}`,
        `GPU: ${metric(gpu)}`,
        `Capabilities exposed by runtime: ${capabilities.length}`,
        `Tasks: ${tasks.length} total · ${runningTasks.length} active · ${completedTasks.length} complete`,
        system?.runtime?.port ? `Local runtime port: ${system.runtime.port}` : null,
        systemError ? `Telemetry note: ${systemError}` : null,
        "",
        "The core visual intensity is derived only from telemetry returned by WAKE's existing /system endpoint. Capability satellites are derived only from current runtime capability records."
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  return (
    <section className="wake-core-stage" style={coreStyle} aria-label="WAKE Dark Matter Core">
      <style>{`
        .wake-core-stage{position:relative;overflow:hidden;min-height:560px;margin:0 0 22px;border:1px solid rgba(145,82,255,.24);border-radius:24px;background:radial-gradient(circle at 50% 48%,rgba(77,20,130,.22),rgba(8,5,15,.96) 38%,#030207 78%);box-shadow:inset 0 0 70px rgba(92,31,164,.16),0 24px 70px rgba(0,0,0,.38);isolation:isolate}
        .wake-core-stage:before{content:"";position:absolute;inset:-30%;background:conic-gradient(from 25deg,transparent 0 13%,rgba(113,58,214,.06) 18%,transparent 24% 44%,rgba(176,86,255,.05) 52%,transparent 59% 100%);animation:wake-drift 22s linear infinite;z-index:-2}
        .wake-core-stage:after{content:"";position:absolute;inset:0;background-image:radial-gradient(circle,rgba(199,158,255,.46) 0 1px,transparent 1.4px);background-size:47px 47px;opacity:.14;mask-image:radial-gradient(circle at center,#000,transparent 76%);z-index:-1}
        .wake-core-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px 0;position:relative;z-index:4}
        .wake-core-header small{display:block;color:#a98ae5;text-transform:uppercase;letter-spacing:.18em;font-size:.68rem;font-weight:800}
        .wake-core-header h2{margin:5px 0 4px;font-size:clamp(1.5rem,3vw,2.35rem);letter-spacing:.04em;color:#f4eeff}
        .wake-core-header p{margin:0;color:#978da8;max-width:670px;font-size:.88rem}
        .wake-core-live{display:flex;align-items:center;gap:7px;color:${runtimeOnline ? "#c6ffd8" : "#d7cbe8"};font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;white-space:nowrap}
        .wake-core-live i{width:9px;height:9px;border-radius:50%;background:${runtimeOnline ? "#70ff9b" : "#8b799d"};box-shadow:${runtimeOnline ? "0 0 18px #70ff9b" : "none"}}
        .wake-core-space{position:relative;min-height:390px;margin:4px 14px 0}
        .wake-core-orbit{position:absolute;left:50%;top:50%;border:1px solid rgba(154,103,243,.14);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
        .wake-core-orbit.one{width:300px;height:300px;animation:wake-orbit 20s linear infinite}
        .wake-core-orbit.two{width:390px;height:230px;transform:translate(-50%,-50%) rotate(-22deg);animation:wake-orbit-wide 30s linear infinite}
        .wake-core-orbit.three{width:460px;height:330px;border-style:dashed;opacity:.54;transform:translate(-50%,-50%) rotate(24deg)}
        .wake-core-brain{position:absolute;left:50%;top:50%;width:230px;height:230px;transform:translate(-50%,-50%);border:0;border-radius:50%;cursor:pointer;background:radial-gradient(circle at 47% 44%,rgba(184,107,255,.38) 0 3%,rgba(96,24,164,.24) 15%,rgba(24,6,38,.94) 43%,#030106 70%);box-shadow:0 0 calc(28px + 48px * var(--wake-intensity)) rgba(142,65,255,calc(.22 + .42 * var(--wake-intensity))),inset 0 0 42px rgba(192,115,255,.25);transition:box-shadow .5s ease;z-index:3}
        .wake-core-brain:before,.wake-core-brain:after{content:"";position:absolute;inset:12%;border-radius:50%;border:1px solid rgba(208,153,255,.18)}
        .wake-core-brain:before{clip-path:polygon(0 46%,18% 42%,24% 15%,39% 38%,51% 2%,58% 43%,86% 26%,69% 58%,98% 66%,61% 70%,58% 99%,42% 72%,10% 88%,31% 59%);background:linear-gradient(118deg,transparent 34%,rgba(194,116,255,.72) 35% 36%,transparent 37% 59%,rgba(101,192,255,.42) 60% 61%,transparent 62%);filter:drop-shadow(0 0 6px rgba(178,88,255,.7));animation:wake-fracture 4.6s ease-in-out infinite}
        .wake-core-brain:after{inset:28%;background:radial-gradient(circle,#efe0ff 0 3%,#b65cff 6%,rgba(113,34,188,.66) 17%,transparent 52%);border:0;box-shadow:0 0 24px rgba(193,109,255,.58);animation:wake-pulse calc(3.8s - 1.4s * var(--wake-intensity)) ease-in-out infinite}
        .wake-core-label{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;pointer-events:none;text-align:center;color:#fff;text-shadow:0 0 22px rgba(186,111,255,.8)}
        .wake-core-label strong{display:block;font-size:1.15rem;letter-spacing:.24em;margin-left:.24em}
        .wake-core-label span{display:block;margin-top:8px;font-size:.65rem;letter-spacing:.15em;color:#c6abea;text-transform:uppercase}
        .wake-core-satellite{position:absolute;transform:translate(-50%,-50%);width:82px;min-height:50px;border:1px solid rgba(154,94,236,.23);border-radius:14px;background:rgba(11,7,18,.82);backdrop-filter:blur(8px);padding:8px 9px;color:#ded1ef;z-index:4;text-align:left;box-shadow:0 0 18px rgba(74,23,122,.12)}
        .wake-core-satellite.live{border-color:rgba(112,255,155,.28);box-shadow:0 0 18px rgba(91,255,140,.08)}
        .wake-core-satellite strong{display:block;font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wake-core-satellite small{font-size:.58rem;color:#857992;text-transform:uppercase;letter-spacing:.08em}
        .wake-core-satellite i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#806a93;margin-right:5px}.wake-core-satellite.live i{background:#70ff9b;box-shadow:0 0 9px rgba(112,255,155,.7)}
        .wake-core-pulse-line{position:absolute;left:50%;top:50%;width:38%;height:1px;transform-origin:left center;background:linear-gradient(90deg,rgba(186,96,255,.42),transparent);opacity:.28;z-index:1}
        .wake-core-pulse-line.active:after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;top:-3px;left:4%;background:#d799ff;box-shadow:0 0 13px #b55cff;animation:wake-job 2.1s ease-in-out infinite}
        .wake-core-hud{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:0 18px 18px;position:relative;z-index:4}
        .wake-core-stat{border:1px solid rgba(147,99,204,.16);border-radius:14px;background:rgba(9,6,14,.74);padding:12px 13px;display:grid;grid-template-columns:auto 1fr;column-gap:9px;align-items:center}.wake-core-stat svg{color:#b886f3}.wake-core-stat small{grid-column:2;color:#81768d;font-size:.62rem;text-transform:uppercase;letter-spacing:.11em}.wake-core-stat strong{grid-column:2;color:#eee6f8;font-size:.93rem}.wake-core-stat em{grid-column:2;font-style:normal;color:#71677d;font-size:.62rem;margin-top:2px}
        .wake-core-truth{position:absolute;right:16px;bottom:95px;z-index:5;color:#746a80;font-size:.6rem;text-transform:uppercase;letter-spacing:.11em}
        @keyframes wake-drift{to{transform:rotate(360deg)}}@keyframes wake-orbit{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes wake-orbit-wide{to{transform:translate(-50%,-50%) rotate(338deg)}}@keyframes wake-pulse{0%,100%{transform:scale(.82);opacity:.65}50%{transform:scale(1.18);opacity:1}}@keyframes wake-fracture{0%,100%{opacity:.5;transform:rotate(0)}50%{opacity:1;transform:rotate(4deg)}}@keyframes wake-job{0%{left:3%;opacity:0}18%{opacity:1}82%{opacity:1}100%{left:94%;opacity:0}}
        @media(max-width:760px){.wake-core-stage{min-height:650px}.wake-core-header{padding:18px 17px 0;display:block}.wake-core-live{margin-top:9px}.wake-core-space{min-height:405px}.wake-core-orbit.three{width:390px}.wake-core-satellite{width:70px;padding:7px}.wake-core-hud{grid-template-columns:repeat(2,1fr)}.wake-core-truth{position:static;padding:0 18px 14px;display:block}}
        @media(prefers-reduced-motion:reduce){.wake-core-stage:before,.wake-core-orbit,.wake-core-brain:before,.wake-core-brain:after,.wake-core-pulse-line.active:after{animation:none!important}}
      `}</style>

      <header className="wake-core-header">
        <div>
          <small>WAKE / Cognitive Runtime</small>
          <h2>Dark Matter Core</h2>
          <p>The brain is WAKE. Everything visible around it is derived from the runtime currently reporting to this machine.</p>
        </div>
        <div className="wake-core-live">
          <i /> {runtimeOnline ? "runtime live" : systemError ? "telemetry unavailable" : "sampling"}
        </div>
      </header>

      <div className="wake-core-space">
        <div className="wake-core-orbit one" />
        <div className="wake-core-orbit two" />
        <div className="wake-core-orbit three" />

        {runningTasks.slice(0, 4).map((task, index) => (
          <span
            key={`${task.id || task.title}-${pulse}`}
            className="wake-core-pulse-line active"
            style={{ transform: `rotate(${42 + index * 76}deg)` }}
            aria-hidden="true"
          />
        ))}

        <button className="wake-core-brain" type="button" onClick={openCoreStatus} aria-label="Open WAKE core status" />
        <div className="wake-core-label" aria-hidden="true">
          <strong>WAKE</strong>
          <span>{availableMetrics.length ? `${activity}% field load` : "field sampling"}</span>
        </div>

        {capabilities.map((capability, index) => {
          const tone = String(capability.status || "").toLowerCase();
          const live = ["live", "ready", "verified", "active", "available"].some((word) => tone.includes(word));
          return (
            <div
              key={capability.id || capability.label}
              className={`wake-core-satellite ${live ? "live" : ""}`}
              style={satellitePosition(index, capabilities.length)}
              title={capability.detail || capability.label}
            >
              <strong><i />{capability.label}</strong>
              <small>{capability.status || "reported"}</small>
            </div>
          );
        })}
      </div>

      <div className="wake-core-hud">
        <div className="wake-core-stat"><Cpu size={18} /><strong>{metric(cpu)}</strong><small>CPU</small><em>{system?.cpu?.cores ? `${system.cpu.cores} cores` : "local telemetry"}</em></div>
        <div className="wake-core-stat"><MemoryStick size={18} /><strong>{metric(memory)}</strong><small>RAM</small><em>{system?.memory?.usedGb != null && system?.memory?.totalGb != null ? `${system.memory.usedGb}/${system.memory.totalGb} GB` : "local telemetry"}</em></div>
        <div className="wake-core-stat"><Gauge size={18} /><strong>{metric(gpu)}</strong><small>GPU</small><em>{system?.gpu?.name || "not reported"}</em></div>
        <div className="wake-core-stat"><Activity size={18} /><strong>{runningTasks.length}</strong><small>Active jobs</small><em>{tasks.length} task records</em></div>
        <div className="wake-core-stat"><Radio size={18} /><strong>{runtimeOnline ? `:${system?.runtime?.port || "local"}` : "sampling"}</strong><small>Runtime</small><em>{system?.runtime?.pid ? `PID ${system.runtime.pid}` : "process state"}</em></div>
        <div className="wake-core-stat"><Database size={18} /><strong>{state?.runtime?.sources ?? 0}</strong><small>Sources</small><em>runtime memory inventory</em></div>
        <div className="wake-core-stat"><Zap size={18} /><strong>{capabilities.length}</strong><small>Capabilities</small><em>reported by WAKE state</em></div>
        <div className="wake-core-stat"><Activity size={18} /><strong>{completedTasks.length}</strong><small>Completed</small><em>task records complete</em></div>
      </div>

      <span className="wake-core-truth">truth-backed visualization · no synthetic nodes</span>
    </section>
  );
}
