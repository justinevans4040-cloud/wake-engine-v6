import crypto from "node:crypto";

/**
 * WAKE Engine V6 Real-Time Audio Spectrum & Waveform Engine
 * Generates dynamic audio spectrum waveform data and SVG overlays for voice synthesis & video reels.
 */

export const WAVEFORM_STYLES = Object.freeze([
  { id: "bars", name: "Dynamic Equalizer Bars", description: "Vertical frequency bars with neon glow" },
  { id: "smooth-wave", name: "Smooth Sine Wave", description: "Continuous oscillating bezier waveform" },
  { id: "neon-pulse", name: "Neon Center Pulse", description: "Bilateral amplitude pulse from center" },
  { id: "radial", name: "Radial Spectrum Ring", description: "Circular expanding frequency ring" }
]);

export function generateWaveformData(durationSec = 15, sampleCount = 64) {
  const duration = Math.max(1, Math.min(180, Number(durationSec) || 15));
  const count = Math.max(16, Math.min(256, sampleCount));

  // Generate deterministic yet natural-looking speech amplitude envelope
  const samples = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // Mix low-frequency envelope with high-frequency phonetic bursts
    const envelope = Math.sin(t * Math.PI) * 0.7 + 0.3;
    const burst = Math.sin(i * 0.8) * Math.cos(i * 0.3);
    const noise = (Math.sin(i * 3.7) + 1) * 0.15;
    const rawAmp = (Math.abs(burst) * 0.6 + noise) * envelope;
    const amplitude = Math.max(0.12, Math.min(1.0, Number(rawAmp.toFixed(3))));

    samples.push({
      index: i,
      timeSec: Number(((t * duration)).toFixed(2)),
      amplitude,
      frequencyHz: Math.round(120 + Math.sin(i * 0.5) * 80 + (i % 8) * 200)
    });
  }

  return {
    durationSec: duration,
    sampleCount: count,
    samples
  };
}

export function generateWaveformSvg({
  durationSec = 15,
  style = "bars",
  sampleCount = 48,
  color = "#00ffc8",
  width = 800,
  height = 160
} = {}) {
  const { samples } = generateWaveformData(durationSec, sampleCount);
  const midY = height / 2;
  const barWidth = width / sampleCount;

  let svgContent = "";

  if (style === "smooth-wave") {
    const points = samples.map((s, i) => {
      const x = i * barWidth;
      const y = midY - s.amplitude * (height * 0.4);
      return `${x},${y}`;
    });
    const bottomPoints = samples.map((s, i) => {
      const x = (sampleCount - 1 - i) * barWidth;
      const y = midY + samples[sampleCount - 1 - i].amplitude * (height * 0.4);
      return `${x},${y}`;
    });

    svgContent = `
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#64b4ff" stop-opacity="0.9" />
        </linearGradient>
      </defs>
      <polygon points="${points.join(" ")} ${bottomPoints.join(" ")}" fill="url(#waveGrad)" opacity="0.85" />
      <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
    `;
  } else if (style === "neon-pulse") {
    svgContent = `
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;
    samples.forEach((s, i) => {
      const x = i * barWidth + barWidth * 0.15;
      const barH = s.amplitude * (height * 0.85);
      const y = midY - barH / 2;
      svgContent += `<rect x="${x}" y="${y}" width="${barWidth * 0.7}" height="${barH}" rx="3" fill="${color}" filter="url(#glow)" opacity="0.9" />`;
    });
  } else {
    // Default 'bars'
    samples.forEach((s, i) => {
      const x = i * barWidth + barWidth * 0.2;
      const barH = s.amplitude * (height * 0.8);
      const y = height - barH - 8;
      svgContent += `<rect x="${x}" y="${y}" width="${barWidth * 0.6}" height="${barH}" rx="2" fill="${color}" opacity="0.85" />`;
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${svgContent}</svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  const svgDataUrl = `data:image/svg+xml;base64,${base64}`;

  return {
    ok: true,
    style,
    color,
    width,
    height,
    durationSec,
    sampleCount,
    svgDataUrl,
    rawSvg: svg
  };
}
