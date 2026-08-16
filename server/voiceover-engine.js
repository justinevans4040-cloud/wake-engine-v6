import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { generateSubtitleTrack } from "./batch-synthesizer.js";

const execFileAsync = promisify(execFile);

/**
 * WAKE Engine V6 Voiceover Engine
 * Produces real local audio via Windows SAPI, optional remote neural TTS, then FFmpeg packaging.
 */

export const VOICE_PROFILES = Object.freeze([
  {
    id: "authority-doc",
    name: "Deep Authority & Documentary",
    gender: "Male",
    pitch: 0.85,
    speed: 0.95,
    windowsVoice: "Microsoft David Desktop",
    timbre: "Warm, resonant, deliberate cadence with gravitas",
    recommendedFor: "Case studies, high-ticket breakdowns, YouTube deep dives"
  },
  {
    id: "hyper-hook",
    name: "High-Energy Viral Reel",
    gender: "Dynamic",
    pitch: 1.1,
    speed: 1.25,
    windowsVoice: "Microsoft Zira Desktop",
    timbre: "Punchy, fast-paced, high dynamic range for short-form retention",
    recommendedFor: "TikTok 9:16, Instagram Reels, YouTube Shorts"
  },
  {
    id: "storyteller",
    name: "Empathetic Storyteller",
    gender: "Female",
    pitch: 1.0,
    speed: 1.0,
    windowsVoice: "Microsoft Zira Desktop",
    timbre: "Conversational, relatable, natural inflection and breathing",
    recommendedFor: "Origin stories, client transformation narratives, podcasts"
  },
  {
    id: "analytical-teardown",
    name: "Analytical Teardown",
    gender: "Neutral",
    pitch: 0.95,
    speed: 1.05,
    windowsVoice: "Microsoft David Desktop",
    timbre: "Crisp, precise, instructional with emphasized key takeaways",
    recommendedFor: "Framework walkthroughs, B2B SaaS teardowns, LinkedIn audio"
  }
]);

function fileExistsNonEmpty(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 44;
  } catch {
    return false;
  }
}

export class NeuralVoiceEngine {
  constructor({ audioOutputDir }) {
    this.audioOutputDir = audioOutputDir;
    if (this.audioOutputDir && !fs.existsSync(this.audioOutputDir)) {
      fs.mkdirSync(this.audioOutputDir, { recursive: true });
    }
  }

  listProfiles() {
    return VOICE_PROFILES;
  }

  async synthesizeWithWindowsSapi(text, wavPath, profile) {
    const textPath = `${wavPath}.txt`;
    const psPath = `${wavPath}.ps1`;
    fs.writeFileSync(textPath, text, "utf8");
    const voiceName = profile.windowsVoice || "Microsoft David Desktop";
    const rate = Math.max(-10, Math.min(10, Math.round(((Number(profile.speed) || 1) - 1) * 10)));
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SelectVoice(${JSON.stringify(voiceName)})
} catch {
  # Keep default installed voice when the preferred voice is missing.
}
$synth.Rate = ${rate}
$synth.SetOutputToWaveFile(${JSON.stringify(wavPath)})
$synth.Speak([IO.File]::ReadAllText(${JSON.stringify(textPath)}))
$synth.Dispose()
if (-not (Test-Path -LiteralPath ${JSON.stringify(wavPath)})) { throw 'SAPI did not write wav output.' }
`;
    fs.writeFileSync(psPath, script, "utf8");
    try {
      await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath],
        { timeout: 60000, windowsHide: true }
      );
    } finally {
      for (const temp of [textPath, psPath]) {
        try { fs.unlinkSync(temp); } catch { /* ignore */ }
      }
    }
    if (!fileExistsNonEmpty(wavPath)) {
      throw new Error("Windows SAPI voice synthesis failed to write audio.");
    }
  }

  async convertWithFfmpeg(inputPath, outputPath) {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "192k", outputPath],
      { timeout: 60000, windowsHide: true }
    );
    if (!fileExistsNonEmpty(outputPath)) {
      throw new Error("FFmpeg audio conversion produced an empty file.");
    }
  }

  async synthesizeSpeech({
    text,
    profileId = "authority-doc",
    speed = 1.0,
    pitch = 1.0,
    format = "mp3",
    remoteEndpoint = null
  }) {
    if (!text || typeof text !== "string" || !text.trim()) {
      throw new Error("Text content is required for speech synthesis.");
    }

    const cleanText = text.trim();
    const profile = VOICE_PROFILES.find((p) => p.id === profileId) || VOICE_PROFILES[0];
    const effectiveSpeed = Number(speed) || profile.speed || 1.0;
    const effectivePitch = Number(pitch) || profile.pitch || 1.0;
    const outputFormat = String(format || "mp3").toLowerCase() === "wav" ? "wav" : "mp3";

    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const wordsPerMinute = 150 * effectiveSpeed;
    const estimatedDurationSec = Math.max(1.5, Math.round((wordCount / wordsPerMinute) * 60));

    const subtitleTrack = generateSubtitleTrack(cleanText, {
      wordsPerMinute,
      format: "srt"
    });
    const vttTrack = generateSubtitleTrack(cleanText, {
      wordsPerMinute,
      format: "vtt"
    });

    const digest = crypto.createHash("sha256").update(`${cleanText}-${profile.id}-${effectiveSpeed}`).digest("hex");
    const filename = `voiceover-${profile.id}-${digest.slice(0, 10)}.${outputFormat}`;
    const audioFilePath = path.join(this.audioOutputDir, filename);
    const wavPath = path.join(os.tmpdir(), `wake-voice-${digest.slice(0, 12)}.wav`);

    let synthesizedVia = null;

    if (remoteEndpoint && remoteEndpoint.startsWith("http")) {
      try {
        const response = await fetch(remoteEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: cleanText,
            voice: profile.id,
            speed: effectiveSpeed,
            response_format: outputFormat
          }),
          signal: AbortSignal.timeout(30000)
        });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 44) {
            fs.writeFileSync(audioFilePath, buffer);
            synthesizedVia = "remote-neural-server";
          }
        }
      } catch {
        // Fall through to local Windows SAPI.
      }
    }

    if (!synthesizedVia) {
      await this.synthesizeWithWindowsSapi(cleanText, wavPath, { ...profile, speed: effectiveSpeed });
      if (outputFormat === "wav") {
        fs.copyFileSync(wavPath, audioFilePath);
      } else {
        try {
          await this.convertWithFfmpeg(wavPath, audioFilePath);
        } catch {
          // If mp3 encode is unavailable, keep a real wav and rename output.
          const wavName = filename.replace(/\.mp3$/i, ".wav");
          const wavOut = path.join(this.audioOutputDir, wavName);
          fs.copyFileSync(wavPath, wavOut);
          try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
          if (!fileExistsNonEmpty(wavOut)) {
            throw new Error("Local voice synthesis failed after FFmpeg conversion error.");
          }
          return {
            ok: true,
            playable: true,
            id: `voice-${digest.slice(0, 16)}`,
            filename: wavName,
            filePath: wavOut,
            relativePath: `data/generated-audio/${wavName}`,
            url: `/generated-audio/${wavName}`,
            profile,
            text: cleanText,
            wordCount,
            estimatedDurationSec,
            speed: effectiveSpeed,
            pitch: effectivePitch,
            synthesizedVia: "windows-sapi",
            format: "wav",
            bytes: fs.statSync(wavOut).size,
            subtitles: {
              srt: subtitleTrack.trackContent,
              vtt: vttTrack.trackContent,
              segmentCount: subtitleTrack.segmentCount,
              timedItems: subtitleTrack.timedItems
            },
            createdAt: new Date().toISOString()
          };
        }
      }
      synthesizedVia = "windows-sapi";
      try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
    }

    if (!fileExistsNonEmpty(audioFilePath)) {
      throw new Error("Voice synthesis did not produce a playable audio file.");
    }

    return {
      ok: true,
      playable: true,
      id: `voice-${digest.slice(0, 16)}`,
      filename,
      filePath: audioFilePath,
      relativePath: `data/generated-audio/${filename}`,
      url: `/generated-audio/${filename}`,
      profile,
      text: cleanText,
      wordCount,
      estimatedDurationSec,
      speed: effectiveSpeed,
      pitch: effectivePitch,
      synthesizedVia,
      format: outputFormat,
      bytes: fs.statSync(audioFilePath).size,
      subtitles: {
        srt: subtitleTrack.trackContent,
        vtt: vttTrack.trackContent,
        segmentCount: subtitleTrack.segmentCount,
        timedItems: subtitleTrack.timedItems
      },
      createdAt: new Date().toISOString()
    };
  }
}
