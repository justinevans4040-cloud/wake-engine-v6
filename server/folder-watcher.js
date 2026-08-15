import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * WAKE Engine V6 Real-Time Folder Watcher
 * Safely monitors local non-cloud directories for incoming assets
 * and triggers automated intake pipelines or queues candidates.
 */

export class LocalFolderWatcher {
  constructor({ onFileDetected, addMonitorLog, isCloudPath }) {
    this.onFileDetected = onFileDetected || (() => {});
    this.addMonitorLog = addMonitorLog || (() => {});
    this.isCloudPath = isCloudPath || (() => false);
    this.watchers = new Map(); // watcherId -> { id, path, projectId, active, fsWatcher, stats }
    this.processedFiles = new Set();
  }

  addWatchDirectory(id, dirPath, projectId, options = {}) {
    if (!dirPath || typeof dirPath !== "string") {
      throw new Error("Valid local directory path is required.");
    }
    if (this.isCloudPath(dirPath)) {
      throw new Error("Watched directory must be a local non-cloud-synchronized folder.");
    }
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Close existing if updating
    this.removeWatchDirectory(id);

    try {
      const fsWatcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(dirPath, filename);
        this._handleFileEvent(id, fullPath, projectId, options);
      });

      this.watchers.set(id, {
        id,
        path: dirPath,
        projectId,
        active: true,
        options,
        fsWatcher,
        createdAt: new Date().toISOString(),
        filesDetectedCount: 0
      });

      this.addMonitorLog("ok", `Folder watcher active: ${dirPath}`);
      return true;
    } catch (err) {
      this.addMonitorLog("warn", `Failed to attach folder watcher: ${dirPath} (${err.message})`);
      throw err;
    }
  }

  _handleFileEvent(watcherId, fullPath, projectId, options) {
    if (this.processedFiles.has(fullPath)) return;
    if (!fs.existsSync(fullPath)) return;

    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile() || stat.size === 0) return;

      // Mark as processed with debounce
      this.processedFiles.add(fullPath);
      setTimeout(() => this.processedFiles.delete(fullPath), 5000);

      const watcher = this.watchers.get(watcherId);
      if (watcher) watcher.filesDetectedCount += 1;

      this.addMonitorLog("ok", `Folder watcher detected file: ${path.basename(fullPath)}`);
      this.onFileDetected({
        watcherId,
        filePath: fullPath,
        filename: path.basename(fullPath),
        sizeBytes: stat.size,
        projectId,
        detectedAt: new Date().toISOString()
      });
    } catch {
      // Ignore transient access lock errors while file is being written
    }
  }

  removeWatchDirectory(id) {
    const watcher = this.watchers.get(id);
    if (watcher) {
      if (watcher.fsWatcher) {
        try {
          watcher.fsWatcher.close();
        } catch {}
      }
      this.watchers.delete(id);
      this.addMonitorLog("ok", `Removed folder watcher: ${watcher.path}`);
      return true;
    }
    return false;
  }

  listWatchers() {
    return Array.from(this.watchers.values()).map((w) => ({
      id: w.id,
      path: w.path,
      projectId: w.projectId,
      active: w.active,
      createdAt: w.createdAt,
      filesDetectedCount: w.filesDetectedCount
    }));
  }

  stopAll() {
    for (const id of this.watchers.keys()) {
      this.removeWatchDirectory(id);
    }
  }
}
