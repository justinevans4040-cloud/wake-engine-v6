const DEFAULT_TIMEOUT_MS = 20000;
let csrfToken = sessionStorage.getItem("wake.csrfToken") || "";

function updateSession(data) {
  if (data?.csrfToken) {
    csrfToken = data.csrfToken;
    sessionStorage.setItem("wake.csrfToken", csrfToken);
  }
  if (data?.authenticated === false) {
    csrfToken = "";
    sessionStorage.removeItem("wake.csrfToken");
  }
}

function apiError(response, data) {
  const error = new Error(data.error || response.statusText);
  error.code = data.code || null;
  error.status = response.status;
  if (response.status === 401 && data.code === "AUTH_REQUIRED") window.dispatchEvent(new CustomEvent("wake:auth-required"));
  return error;
}

export async function api(path, body, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`/api${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json", ...(csrfToken ? { "X-Wake-CSRF": csrfToken } : {}) } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    updateSession(data);
    if (!response.ok) throw apiError(response, data);
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`WAKE request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function apiStream(path, body, onEvent, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 30000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-Wake-CSRF": csrfToken } : {}) },
      body: JSON.stringify(body || {}),
      credentials: "same-origin",
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      throw apiError(response, data);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        onEvent(JSON.parse(line));
      }
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer));
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`WAKE stream timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
