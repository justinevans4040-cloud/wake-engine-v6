import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * WAKE Engine V6 Semantic Memory & Vector Search System
 * Supports hybrid dense-sparse embeddings, cosine similarity search,
 * semantic chunking, and durable vector indexing.
 */

// Vector vocabulary / hashing dimension
const VECTOR_DIM = 256;

/**
 * Tokenizes text into normalized semantic terms and n-grams
 */
export function semanticTokens(text) {
  if (!text) return [];
  const normalized = String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").filter((w) => w.length > 1);
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}_${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

/**
 * Computes a normalized sparse-dense feature vector using semantic hashing
 */
export function computeLocalEmbedding(text, dim = VECTOR_DIM) {
  const tokens = semanticTokens(text);
  const vector = new Float32Array(dim);
  if (!tokens.length) return Array.from(vector);

  const freq = new Map();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  for (const [token, count] of freq.entries()) {
    const hash = crypto.createHash("md5").update(token).digest();
    const index = Math.abs(hash.readInt32LE(0)) % dim;
    const sign = (hash[4] % 2 === 0) ? 1 : -1;
    // Log-damped term frequency
    const weight = (1 + Math.log(count)) * sign;
    vector[index] += weight;
  }

  // L2 Normalization
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vector[i] /= norm;
    }
  }

  return Array.from(vector);
}

/**
 * Generates embeddings via remote Ollama endpoint with automatic fallback
 */
export async function generateEmbedding(text, ollamaUrl, model) {
  if (ollamaUrl && model) {
    try {
      const response = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.embedding) && data.embedding.length > 0) {
          // Normalize vector
          let norm = 0;
          for (let v of data.embedding) norm += v * v;
          norm = Math.sqrt(norm);
          if (norm > 0) return data.embedding.map((v) => v / norm);
          return data.embedding;
        }
      }
    } catch {
      // Fallback to local semantic vectorizer
    }
  }
  return computeLocalEmbedding(text);
}

/**
 * Computes Cosine Similarity between two normalized vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * Chunks a document into semantic passages with overlap
 */
export function chunkDocument(text, options = {}) {
  const maxChars = options.maxChars || 800;
  const overlap = options.overlap || 150;
  const raw = String(text || "").trim();
  if (!raw) return [];

  const paragraphs = raw.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if (currentChunk.length + cleanPara.length > maxChars && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        characterCount: currentChunk.trim().length
      });
      // Carry over overlap tail
      currentChunk = currentChunk.slice(-overlap) + "\n\n" + cleanPara;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + cleanPara : cleanPara;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunkIndex++,
      text: currentChunk.trim(),
      characterCount: currentChunk.trim().length
    });
  }

  return chunks;
}

/**
 * Manages in-memory and persisted Vector Index
 */
export class SemanticVectorIndex {
  constructor(storageFile = null) {
    this.storageFile = storageFile;
    this.items = new Map(); // id -> { id, entityId, type, text, vector, metadata }
  }

  load() {
    if (this.storageFile && fs.existsSync(this.storageFile)) {
      try {
        const raw = fs.readFileSync(this.storageFile, "utf8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.items)) {
          this.items.clear();
          for (const item of data.items) {
            this.items.set(item.id, item);
          }
        }
      } catch (err) {
        console.error("Failed to load semantic vector index:", err.message);
      }
    }
  }

  save() {
    if (this.storageFile) {
      try {
        const data = {
          version: "1.0",
          updatedAt: new Date().toISOString(),
          count: this.items.size,
          items: Array.from(this.items.values())
        };
        const tempPath = `${this.storageFile}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
        fs.renameSync(tempPath, this.storageFile);
      } catch (err) {
        console.error("Failed to persist semantic vector index:", err.message);
      }
    }
  }

  async indexSource(source, ollamaUrl = null, model = null) {
    if (!source || !source.id) return;
    const text = source.source || source.content || "";
    const chunks = chunkDocument(text);
    
    // Index full document
    const fullVec = await generateEmbedding(text.slice(0, 1500), ollamaUrl, model);
    this.items.set(`src:${source.id}`, {
      id: `src:${source.id}`,
      entityId: source.id,
      type: "source",
      projectId: source.projectId,
      title: source.title,
      lane: source.lane || "General Source",
      text: text.slice(0, 500),
      vector: fullVec,
      metadata: {
        characterCount: source.characterCount,
        sourceType: source.sourceType,
        tags: source.tags || []
      }
    });

    // Index individual passages
    for (const chunk of chunks) {
      const chunkVec = await generateEmbedding(chunk.text, ollamaUrl, model);
      this.items.set(`chunk:${source.id}:${chunk.index}`, {
        id: `chunk:${source.id}:${chunk.index}`,
        entityId: source.id,
        chunkIndex: chunk.index,
        type: "chunk",
        projectId: source.projectId,
        title: `${source.title} (Passage ${chunk.index + 1})`,
        lane: source.lane || "General Source",
        text: chunk.text,
        vector: chunkVec,
        metadata: {
          characterCount: chunk.characterCount,
          sourceType: source.sourceType,
          tags: source.tags || []
        }
      });
    }
  }

  async indexMedia(asset, ollamaUrl = null, model = null) {
    if (!asset || !asset.id) return;
    const text = `${asset.title} ${asset.lane || ""} ${asset.kind || ""} ${asset.excerpt || ""} ${(asset.tags || []).join(" ")}`;
    const vec = await generateEmbedding(text, ollamaUrl, model);
    this.items.set(`media:${asset.id}`, {
      id: `media:${asset.id}`,
      entityId: asset.id,
      type: "media",
      projectId: asset.projectId,
      title: asset.title,
      lane: asset.lane || "Media Asset",
      text: asset.excerpt || asset.title,
      vector: vec,
      metadata: {
        kind: asset.kind,
        extension: asset.extension,
        path: asset.path,
        sizeBytes: asset.sizeBytes
      }
    });
  }

  async search(query, options = {}) {
    const { projectId = null, limit = 8, minScore = 0.15, type = null, lane = null, ollamaUrl = null, model = null } = options;
    const queryVec = await generateEmbedding(query, ollamaUrl, model);
    const results = [];

    for (const item of this.items.values()) {
      if (projectId && item.projectId && item.projectId !== projectId) continue;
      if (type && item.type !== type) continue;
      if (lane && lane !== "all" && item.lane !== lane) continue;

      const score = cosineSimilarity(queryVec, item.vector);
      if (score >= minScore) {
        results.push({
          ...item,
          score: Math.round(score * 1000) / 1000,
          relevancePercent: Math.round(score * 100)
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}
