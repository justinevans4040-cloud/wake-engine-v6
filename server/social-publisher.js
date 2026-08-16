import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * WAKE Engine V6 Local Publishing Stage Queue
 * Stages export-ready packets for manual publication.
 * Direct social network delivery is not implemented.
 */

export class SocialPublisherEngine {
  constructor({ queueFilePath, addMonitorLog }) {
    this.queueFilePath = queueFilePath;
    this.addMonitorLog = addMonitorLog || (() => {});
    this.ensureQueueFile();
    this.normalizeAccounts();
  }

  ensureQueueFile() {
    if (!fs.existsSync(this.queueFilePath)) {
      const dir = path.dirname(this.queueFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.queueFilePath, JSON.stringify({ items: [], accounts: this.getDefaultAccounts() }, null, 2), "utf8");
    }
  }

  getDefaultAccounts() {
    return [
      { platform: "youtube", name: "YouTube Shorts (manual)", status: "not_configured", accountId: "yt-manual", handles: null },
      { platform: "tiktok", name: "TikTok (manual)", status: "not_configured", accountId: "tt-manual", handles: null },
      { platform: "linkedin", name: "LinkedIn (manual)", status: "not_configured", accountId: "li-manual", handles: null },
      { platform: "x", name: "X / Twitter (manual)", status: "not_configured", accountId: "x-manual", handles: null }
    ];
  }

  normalizeAccounts() {
    const queue = this.readQueue();
    const defaults = this.getDefaultAccounts();
    const nextAccounts = defaults.map((account) => {
      const existing = (queue.accounts || []).find((item) => item.platform === account.platform);
      if (!existing) return account;
      return {
        ...account,
        ...existing,
        status: existing.status === "connected" ? "not_configured" : (existing.status || "not_configured"),
        handles: existing.status === "connected" ? null : existing.handles
      };
    });
    queue.accounts = nextAccounts;
    this.writeQueue(queue);
  }

  readQueue() {
    try {
      this.ensureQueueFile();
      const raw = fs.readFileSync(this.queueFilePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return { items: [], accounts: this.getDefaultAccounts() };
    }
  }

  writeQueue(data) {
    fs.writeFileSync(this.queueFilePath, JSON.stringify(data, null, 2), "utf8");
  }

  getAccounts() {
    const queue = this.readQueue();
    return queue.accounts || this.getDefaultAccounts();
  }

  listQueue({ projectId = null, status = null } = {}) {
    const queue = this.readQueue();
    let items = queue.items || [];
    if (projectId) items = items.filter((i) => i.projectId === projectId);
    if (status) items = items.filter((i) => i.status === status);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  stagePost({
    projectId = "wake-v6-main",
    platform = "tiktok",
    title = "Untitled Post",
    content = "",
    mediaPath = null,
    scheduledAt = null,
    hashtags = []
  }) {
    const queue = this.readQueue();
    const id = `pub-${crypto.randomBytes(6).toString("hex")}`;
    const newItem = {
      id,
      projectId,
      platform: platform.toLowerCase(),
      title,
      content,
      mediaPath,
      scheduledAt: scheduledAt || new Date().toISOString(),
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      status: "staged",
      receipt: null,
      createdAt: new Date().toISOString(),
      note: "Staged for manual publish. WAKE does not post to social networks."
    };

    queue.items = [newItem, ...(queue.items || [])];
    this.writeQueue(queue);
    this.addMonitorLog("ok", `Staged manual-publish packet for ${platform.toUpperCase()}: "${title}" [${id}]`);
    return newItem;
  }

  async dispatchPost(postId) {
    const queue = this.readQueue();
    const item = (queue.items || []).find((i) => i.id === postId);
    if (!item) throw new Error(`Staged post ${postId} not found.`);

    item.status = "failed";
    item.receipt = {
      publishedAt: null,
      externalId: null,
      postUrl: null,
      platform: item.platform,
      latencyMs: 0,
      mediaDelivered: false,
      status: "not_implemented",
      signature: null,
      error: "Direct social publishing is not implemented. Export locally and publish manually."
    };
    this.writeQueue(queue);
    this.addMonitorLog("warn", `Direct dispatch blocked for ${item.platform.toUpperCase()} [${postId}]: not implemented`);
    return {
      ok: false,
      error: "Direct social publishing is not implemented. Export locally and publish manually.",
      item,
      receipt: item.receipt
    };
  }

  deletePost(postId) {
    const queue = this.readQueue();
    const prevLen = (queue.items || []).length;
    queue.items = (queue.items || []).filter((i) => i.id !== postId);
    this.writeQueue(queue);
    return { ok: true, deleted: queue.items.length < prevLen };
  }
}
