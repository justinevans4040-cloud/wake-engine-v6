import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "./durable-storage.js";

function resolveProviderConfig(providerConfig = {}) {
  const apiUrl = String(providerConfig.apiUrl || process.env.WAKE_IMAGE_API_URL || "").trim();
  const apiKey = String(providerConfig.apiKey || "").trim();
  const provider = String(providerConfig.provider || process.env.WAKE_IMAGE_PROVIDER || (apiUrl ? "openai-compatible" : "")).trim().toLowerCase();
  const model = String(providerConfig.model || process.env.WAKE_IMAGE_MODEL || (provider === "huggingface" ? "black-forest-labs/FLUX.1-schnell" : "")).trim();
  return { provider, apiUrl, apiKey, model, publicProviderAvailable: !provider && !apiUrl && !apiKey };
}

const PLATFORM_SIZES = Object.freeze({
  tiktok: { width: 768, height: 1344, size: "1024x1536", aspectRatio: "9:16" },
  instagram: { width: 896, height: 1120, size: "1024x1536", aspectRatio: "4:5" },
  x: { width: 1344, height: 768, size: "1536x1024", aspectRatio: "16:9" },
  linkedin: { width: 1344, height: 768, size: "1536x1024", aspectRatio: "16:9" }
});

function providerEndpoint(config) {
  if (config.publicProviderAvailable) return "https://image.pollinations.ai/prompt/";
  if (config.provider === "huggingface") {
    return config.apiUrl || `https://router.huggingface.co/hf-inference/models/${config.model}`;
  }
  if (config.apiUrl) return config.apiUrl;
  if (config.apiKey && config.provider === "openai") return "https://api.openai.com/v1/images/generations";
  return "";
}

export function imageGenerationStatus({ allowExternal = false, providerConfig = null } = {}) {
  const config = resolveProviderConfig(providerConfig || {});
  const endpoint = providerEndpoint(config);
  const explicitProvider = Boolean(config.provider && config.model && endpoint && config.apiKey);
  const configured = explicitProvider || (config.publicProviderAvailable && allowExternal);
  const provider = explicitProvider ? config.provider : config.publicProviderAvailable ? "pollinations-public" : null;
  const model = explicitProvider ? config.model : config.publicProviderAvailable ? "flux" : null;
  return {
    configured,
    available: explicitProvider || config.publicProviderAvailable,
    provider,
    model,
    endpointType: provider === "huggingface" ? "huggingface-inference" : provider === "pollinations-public" ? "public-image-endpoint" : provider ? "openai-compatible" : null,
    external: provider ? !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(endpoint) : false,
    consentRequired: config.publicProviderAvailable && !allowExternal,
    storesLocally: true,
    createsOriginalImages: configured,
    setupRequired: !configured && !config.publicProviderAvailable
  };
}

function detectImageType(buffer, contentType = "") {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: ".png", mimeType: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return { extension: ".jpg", mimeType: "image/jpeg" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { extension: ".webp", mimeType: "image/webp" };
  if (/png/i.test(contentType)) return { extension: ".png", mimeType: "image/png" };
  if (/jpe?g/i.test(contentType)) return { extension: ".jpg", mimeType: "image/jpeg" };
  if (/webp/i.test(contentType)) return { extension: ".webp", mimeType: "image/webp" };
  throw new Error("Image provider returned data that is not a supported PNG, JPEG, or WebP image.");
}

async function downloadImage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Generated image download failed with HTTP ${response.status}.`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || ""
  };
}

async function requestHuggingFace(prompt, dimensions, config) {
  const response = await fetch(providerEndpoint(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "image/png,image/jpeg,image/webp"
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width: dimensions.width,
        height: dimensions.height,
        num_inference_steps: 28,
        guidance_scale: 3.5
      }
    }),
    signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Hugging Face image generation failed with HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : "."}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || ""
  };
}

async function requestOpenAiCompatible(prompt, dimensions, config) {
  const response = await fetch(providerEndpoint(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      size: dimensions.size,
      quality: "high",
      n: 1,
      response_format: "b64_json"
    }),
    signal: AbortSignal.timeout(180000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || payload.error || `Image generation failed with HTTP ${response.status}.`);
  const image = payload.data?.[0] || payload.images?.[0] || {};
  if (image.b64_json || image.base64) {
    return { buffer: Buffer.from(image.b64_json || image.base64, "base64"), contentType: "image/png" };
  }
  if (image.url) return downloadImage(image.url);
  throw new Error("Image provider returned no image data.");
}

async function requestPollinations(prompt, dimensions, config) {
  const seed = Number.parseInt(crypto.createHash("sha256").update(`${prompt}-${Date.now()}`).digest("hex").slice(0, 8), 16);
  const url = new URL(encodeURIComponent(prompt), providerEndpoint(config));
  url.searchParams.set("width", String(dimensions.width));
  url.searchParams.set("height", String(dimensions.height));
  url.searchParams.set("model", "flux");
  url.searchParams.set("nologo", "true");
  url.searchParams.set("seed", String(seed));
  const response = await fetch(url, {
    headers: { Accept: "image/jpeg,image/png,image/webp" },
    signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) throw new Error(`Public image generation failed with HTTP ${response.status}.`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || ""
  };
}

export async function generateOriginalImage({ prompt, platform = "instagram", outputDir, projectId, campaignId, index = 0, allowExternal = false, providerConfig = null }) {
  const config = resolveProviderConfig(providerConfig || {});
  const status = imageGenerationStatus({ allowExternal, providerConfig: config });
  if (!status.configured) {
    const error = new Error(status.consentRequired ? "External image generation needs one-time approval." : "Original image generation needs a one-time image provider connection.");
    error.code = status.consentRequired ? "IMAGE_PROVIDER_CONSENT_REQUIRED" : "IMAGE_PROVIDER_REQUIRED";
    throw error;
  }
  const dimensions = PLATFORM_SIZES[platform] || PLATFORM_SIZES.instagram;
  const finalPrompt = [
    String(prompt || "").trim(),
    "Create an original, premium editorial campaign image.",
    `Composition must work at ${dimensions.aspectRatio}.`,
    "No logos, watermarks, interface chrome, captions, or rendered text.",
    "Use a clear focal subject, deliberate lighting, tactile detail, and professional art direction."
  ].filter(Boolean).join(" ");
  const generated = status.provider === "huggingface"
    ? await requestHuggingFace(finalPrompt, dimensions, config)
    : status.provider === "pollinations-public"
      ? await requestPollinations(finalPrompt, dimensions, config)
      : await requestOpenAiCompatible(finalPrompt, dimensions, config);
  const type = detectImageType(generated.buffer, generated.contentType);
  fs.mkdirSync(outputDir, { recursive: true });
  const digest = crypto.createHash("sha256").update(generated.buffer).digest("hex");
  const filename = `${campaignId}-${platform}-${index + 1}-${digest.slice(0, 10)}${type.extension}`;
  const absolutePath = path.join(outputDir, filename);
  writeFileAtomic(absolutePath, generated.buffer);
  return {
    id: `image-${digest.slice(0, 16)}`,
    projectId,
    campaignId,
    platform,
    prompt: finalPrompt,
    provider: status.provider,
    model: status.model,
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.aspectRatio,
    mimeType: type.mimeType,
    sha256: digest,
    filename,
    absolutePath,
    relativePath: `data/generated-images/${filename}`,
    url: `/generated-images/${filename}`,
    original: true,
    createdAt: new Date().toISOString()
  };
}

export const IMAGE_PLATFORM_SIZES = PLATFORM_SIZES;
