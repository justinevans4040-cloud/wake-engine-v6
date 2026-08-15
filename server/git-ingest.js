import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FLAGSHIP_KEYWORDS = [
  "wake engine",
  "python pal",
  "forgefront",
  "crave-it-create-it",
  "crave it create it",
  "athere titan",
  "athere mesh",
  "sixth gate",
  "architectural renaissance",
  "architects renaissance",
  "odin lineforge",
  "miss vale",
  "voicecore",
  "qra operator",
  "rack runner",
  "green rack runner"
];

function classifyFile(fileName, relativePath) {
  const ext = path.extname(fileName).toLowerCase();
  const lowerPath = relativePath.toLowerCase();

  // Flagship Check
  const isFlagship = FLAGSHIP_KEYWORDS.some((kw) => lowerPath.includes(kw));

  // Category & Lane Detection
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"].includes(ext)) {
    let sublane = "Brand & UI Visuals";
    if (lowerPath.includes("sixth gate")) sublane = "The Sixth Gate";
    else if (lowerPath.includes("architectural") || lowerPath.includes("architects")) sublane = "Architectural Renaissance";
    else if (lowerPath.includes("athere") || lowerPath.includes("titan")) sublane = "Athere & Titan Diagrams";
    else if (lowerPath.includes("python pal")) sublane = "Python Pal Screenshots";
    else if (lowerPath.includes("wake") || lowerPath.includes("rack runner")) sublane = "WAKE Engine & Rack Runner";
    else if (lowerPath.includes("forgefront") || lowerPath.includes("crave")) sublane = "ForgeFront Visuals";
    return { category: "picture", kind: "image", lane: sublane, isFlagship };
  }

  if ([".mp4", ".mov", ".webm", ".mkv", ".avi"].includes(ext)) {
    let sublane = "Demo Videos";
    if (lowerPath.includes("forgefront")) sublane = "ForgeFront Demos";
    else if (lowerPath.includes("wake")) sublane = "WAKE Engine Demos";
    else if (lowerPath.includes("python pal")) sublane = "Python Pal Walkthroughs";
    else if (lowerPath.includes("athere") || lowerPath.includes("titan")) sublane = "Athere & Titan Clips";
    else if (lowerPath.includes("progress") || lowerPath.includes("before-after")) sublane = "Build Progress Clips";
    return { category: "video", kind: "video", lane: sublane, isFlagship };
  }

  if ([".apk", ".appx", ".exe", ".msi", ".dmg"].includes(ext) || lowerPath.includes("apps") || lowerPath.includes("builds")) {
    let sublane = "Apps & Builds";
    if (lowerPath.includes("python pal")) sublane = "Python Pal Build";
    else if (lowerPath.includes("wake")) sublane = "WAKE Engine Build";
    else if (lowerPath.includes("crave") || lowerPath.includes("forgefront")) sublane = "ForgeFront App";
    else if (lowerPath.includes("titan")) sublane = "Athere Titan Architecture";
    else if (lowerPath.includes("odin")) sublane = "ODIN LineForge Pipeline";
    else if (lowerPath.includes("vale") || lowerPath.includes("voicecore")) sublane = "VoiceCore Operator Stack";
    return { category: "app", kind: "build", lane: sublane, isFlagship };
  }

  // Documents & Evidence Packs
  let docLane = "Evidence & Documents";
  if (lowerPath.includes("athere") || lowerPath.includes("mesh")) docLane = "Athere Mesh Public Claims";
  else if (lowerPath.includes("titan") || lowerPath.includes("judge")) docLane = "Titan Evidence & Judge Pack";
  else if (lowerPath.includes("system_state") || lowerPath.includes("truth")) docLane = "WAKE Engine Truth Docs";
  else if (lowerPath.includes("forgefront") || lowerPath.includes("handoff")) docLane = "ForgeFront Client Readiness";
  else if (lowerPath.includes("curriculum") || lowerPath.includes("python pal")) docLane = "Python Pal Curriculum Evidence";
  else if (lowerPath.includes("odin") || lowerPath.includes("registry")) docLane = "ODIN Source Registry & Audit";

  return { category: "document", kind: "document", lane: docLane, isFlagship };
}

export class GitHubIngestEngine {
  constructor({ intakeDir, addMonitorLog }) {
    this.intakeDir = intakeDir;
    this.reposDir = path.join(intakeDir, "github-repos");
    this.addMonitorLog = addMonitorLog || console.log;
    fs.mkdirSync(this.reposDir, { recursive: true });
  }

  sanitizeRepoUrl(rawUrl, token = "") {
    let clean = String(rawUrl || "").trim();
    if (!clean) throw new Error("GitHub repository URL is required.");
    // Normalize github.com URL
    clean = clean.replace(/\.git$/i, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://") && !clean.startsWith("git@")) {
      clean = `https://github.com/${clean.replace(/^\/+/, "")}`;
    }
    const match = clean.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/i);
    if (!match) throw new Error("Invalid GitHub repository URL format. Expected: https://github.com/owner/repo");
    const owner = match[1];
    const repo = match[2];
    const slug = `${owner}_${repo}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    let authUrl = `https://github.com/${owner}/${repo}.git`;
    if (token) {
      authUrl = `https://${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
    }
    return { cleanUrl: `https://github.com/${owner}/${repo}`, authUrl, owner, repo, slug };
  }

  async checkGitAvailable() {
    try {
      const { stdout } = await execFileAsync("git", ["--version"]);
      return stdout.trim();
    } catch {
      throw new Error("Git is not installed or not found in system PATH. Install Git for Windows to enable GitHub cloning.");
    }
  }

  async cloneRepo({ repoUrl, branch = "main", token = "", projectId = "wake-v6-main" }) {
    await this.checkGitAvailable();
    const { cleanUrl, authUrl, owner, repo, slug } = this.sanitizeRepoUrl(repoUrl, token);
    const targetPath = path.join(this.reposDir, slug);

    let isNewClone = false;
    if (!fs.existsSync(targetPath)) {
      isNewClone = true;
      this.addMonitorLog("info", `Cloning GitHub repo: ${cleanUrl} (${branch})`);
      const args = ["clone", "--depth", "1"];
      if (branch) args.push("--branch", branch);
      args.push(authUrl, targetPath);
      await execFileAsync("git", args, { windowsHide: true });
    } else {
      this.addMonitorLog("info", `Updating existing repo: ${cleanUrl}`);
      await execFileAsync("git", ["pull"], { cwd: targetPath, windowsHide: true });
    }

    // Get current commit info
    let commitInfo = "Unknown commit";
    try {
      const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%h — %s (%cd)"], { cwd: targetPath, windowsHide: true });
      commitInfo = stdout.trim();
    } catch {}

    // Index the repository files into the WAKE Engine inventory
    const inventory = this.indexRepository(targetPath, slug, cleanUrl, projectId);
    this.addMonitorLog("ok", `GitHub repo indexed: ${inventory.scannedCount} files across ${inventory.sources.length} sources and ${inventory.media.length} media assets.`);

    return {
      ok: true,
      repoName: `${owner}/${repo}`,
      slug,
      url: cleanUrl,
      localPath: targetPath,
      branch,
      commit: commitInfo,
      isNewClone,
      inventory
    };
  }

  indexRepository(repoPath, slug, repoUrl, projectId) {
    const sources = [];
    const media = [];
    const stats = {
      pictures: 0,
      videos: 0,
      apps: 0,
      documents: 0,
      flagship: 0
    };

    const crawl = (dir, depth = 0) => {
      if (depth > 8) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".git") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(repoPath, fullPath);

        if (entry.isDirectory()) {
          crawl(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const classification = classifyFile(entry.name, relPath);
          const ext = path.extname(entry.name).toLowerCase();
          const fileStat = fs.statSync(fullPath);

          if (classification.isFlagship) stats.flagship += 1;

          if (classification.category === "picture" || classification.category === "video") {
            if (classification.category === "picture") stats.pictures += 1;
            if (classification.category === "video") stats.videos += 1;

            media.push({
              id: `git-media-${crypto.createHash("sha256").update(fullPath).digest("hex").slice(0, 12)}`,
              projectId,
              title: entry.name,
              kind: classification.kind,
              lane: classification.lane,
              path: fullPath,
              relativePath: relPath,
              sourceRepo: repoUrl,
              sizeBytes: fileStat.size,
              isFlagship: classification.isFlagship,
              importedAt: new Date().toISOString()
            });
          } else {
            // Text or Document Source
            if (classification.category === "app") stats.apps += 1;
            else stats.documents += 1;

            if ([".md", ".txt", ".json", ".js", ".ts", ".py", ".html", ".css", ".yaml", ".yml"].includes(ext) && fileStat.size < 2000000) {
              try {
                const content = fs.readFileSync(fullPath, "utf8");
                if (content.trim()) {
                  sources.push({
                    id: `git-src-${crypto.createHash("sha256").update(fullPath).digest("hex").slice(0, 12)}`,
                    projectId,
                    title: `[${classification.lane}] ${entry.name}`,
                    lane: classification.lane,
                    sourceType: `GitHub: ${slug}`,
                    localPath: fullPath,
                    relativePath: relPath,
                    sourceRepo: repoUrl,
                    content,
                    characterCount: content.length,
                    isFlagship: classification.isFlagship,
                    importedAt: new Date().toISOString()
                  });
                }
              } catch {}
            }
          }
        }
      }
    };

    crawl(repoPath, 0);

    return {
      scannedCount: sources.length + media.length,
      stats,
      sources,
      media
    };
  }

  listRepos() {
    if (!fs.existsSync(this.reposDir)) return [];
    const entries = fs.readdirSync(this.reposDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const fullPath = path.join(this.reposDir, e.name);
        let commit = "Local cloned";
        try {
          const head = fs.readFileSync(path.join(fullPath, ".git", "HEAD"), "utf8").trim();
          commit = head.slice(0, 20);
        } catch {}
        return {
          slug: e.name,
          path: fullPath,
          commit,
          modifiedAt: fs.statSync(fullPath).mtime
        };
      });
  }
}
