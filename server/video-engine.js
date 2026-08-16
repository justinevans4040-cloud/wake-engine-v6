import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * WAKE Engine V6 Local Video Rendering Engine
 * Builds real 9:16 MP4 reels with FFmpeg from image/audio (or solid-color + audio).
 */

function fileExistsNonEmpty(filePath, minBytes = 100) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).size > minBytes;
  } catch {
    return false;
  }
}

export class LocalVideoEngine {
  constructor({ videoOutputDir }) {
    this.videoOutputDir = videoOutputDir;
    if (this.videoOutputDir && !fs.existsSync(this.videoOutputDir)) {
      fs.mkdirSync(this.videoOutputDir, { recursive: true });
    }
  }

  async checkFfmpeg() {
    try {
      const { stdout } = await execFileAsync("ffmpeg", ["-version"], { timeout: 3000, windowsHide: true });
      return { available: true, version: stdout.split("\n")[0] };
    } catch {
      return { available: false, version: null, note: "FFmpeg CLI not detected on PATH." };
    }
  }

  async renderVerticalReel({
    imagePath = null,
    audioPath = null,
    srtContent = null,
    title = "WAKE Reel",
    duration = 15,
    platform = "tiktok",
    backgroundColor = "black"
  }) {
    const digest = crypto.createHash("sha256").update(`${title}-${audioPath || ""}-${imagePath || ""}-${Date.now()}`).digest("hex");
    const ffmpegStatus = await this.checkFfmpeg();
    if (!ffmpegStatus.available) {
      return {
        ok: false,
        playable: false,
        error: "FFmpeg is required to render a real MP4 reel.",
        ffmpegAvailable: false,
        createdAt: new Date().toISOString()
      };
    }

    if (!fileExistsNonEmpty(audioPath, 44)) {
      return {
        ok: false,
        playable: false,
        error: "A real audio file is required. Synthesize voiceover first, then render the reel.",
        ffmpegAvailable: true,
        createdAt: new Date().toISOString()
      };
    }

    const actualFilename = `reel-${platform}-${digest.slice(0, 10)}.mp4`;
    const outputPath = path.join(this.videoOutputDir, actualFilename);
    const hasImage = fileExistsNonEmpty(imagePath, 32);
    const args = ["-y"];

    if (hasImage) {
      args.push("-loop", "1", "-i", imagePath);
    } else {
      const seconds = Math.max(1, Number(duration) || 15);
      args.push(
        "-f", "lavfi",
        "-i", `color=c=${String(backgroundColor || "black")}:s=1080x1920:d=${seconds}`
      );
    }
    args.push("-i", audioPath);

    let videoFilter = hasImage
      ? "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
      : "format=yuv420p";

    let srtPath = null;
    if (srtContent && String(srtContent).trim()) {
      srtPath = path.join(os.tmpdir(), `wake-reel-${digest.slice(0, 10)}.srt`);
      fs.writeFileSync(srtPath, String(srtContent), "utf8");
      const escaped = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      videoFilter = `${videoFilter},subtitles='${escaped}'`;
    }

    args.push(
      "-c:v", "libx264",
      "-tune", hasImage ? "stillimage" : "fastdecode",
      "-c:a", "aac",
      "-b:a", "192k",
      "-pix_fmt", "yuv420p",
      "-vf", videoFilter,
      "-shortest",
      "-movflags", "+faststart",
      outputPath
    );

    try {
      await execFileAsync("ffmpeg", args, { timeout: 120000, windowsHide: true });
    } catch (err) {
      if (srtPath) {
        try { fs.unlinkSync(srtPath); } catch { /* ignore */ }
      }
      return {
        ok: false,
        playable: false,
        error: `FFmpeg render failed: ${err.message}`,
        ffmpegAvailable: true,
        createdAt: new Date().toISOString()
      };
    } finally {
      if (srtPath) {
        try { fs.unlinkSync(srtPath); } catch { /* ignore */ }
      }
    }

    if (!fileExistsNonEmpty(outputPath, 1000)) {
      return {
        ok: false,
        playable: false,
        error: "FFmpeg finished but did not produce a playable MP4.",
        ffmpegAvailable: true,
        createdAt: new Date().toISOString()
      };
    }

    return {
      ok: true,
      playable: true,
      id: `video-${digest.slice(0, 16)}`,
      filename: actualFilename,
      filePath: outputPath,
      relativePath: `data/generated-videos/${actualFilename}`,
      url: `/generated-videos/${actualFilename}`,
      title,
      platform,
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      durationSec: Number(duration) || 15,
      renderedVia: "ffmpeg-libx264",
      format: "mp4",
      bytes: fs.statSync(outputPath).size,
      ffmpegAvailable: true,
      usedImage: hasImage,
      createdAt: new Date().toISOString()
    };
  }
}
