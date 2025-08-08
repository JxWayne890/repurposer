import React, { useEffect, useMemo, useState } from "react";
import type { ApiResponse, Clip } from "./types";
import { copyToClipboard } from "./utils/copy";

const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL as string | undefined;
const WEBHOOK_PATH_TEST = import.meta.env.VITE_WEBHOOK_PATH_TEST as string | undefined;
const WEBHOOK_PATH_ACTIVE = import.meta.env.VITE_WEBHOOK_PATH_ACTIVE as string | undefined;

export default function App() {
  // form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [maxClipLength, setMaxClipLength] = useState<number>(60);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [removeFillerWords, setRemoveFillerWords] = useState(true);
  const [useActiveWorkflow, setUseActiveWorkflow] = useState(false);

  // ui state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!WEBHOOK_URL) console.warn("VITE_WEBHOOK_URL is missing.");
    if (!WEBHOOK_PATH_TEST) console.warn("VITE_WEBHOOK_PATH_TEST is missing.");
    if (!WEBHOOK_PATH_ACTIVE) console.warn("VITE_WEBHOOK_PATH_ACTIVE is missing.");
  }, []);

  // which path to use
  const selectedPath = useMemo(() => {
    const p = useActiveWorkflow ? WEBHOOK_PATH_ACTIVE : WEBHOOK_PATH_TEST;
    return p ?? "";
  }, [useActiveWorkflow]);

  // full endpoint
  const endpoint = useMemo(() => {
    if (!WEBHOOK_URL || !selectedPath) return "";
    const base = WEBHOOK_URL.endsWith("/") ? WEBHOOK_URL.slice(0, -1) : WEBHOOK_URL;
    const path = selectedPath.startsWith("/") ? selectedPath : `/${selectedPath}`;
    return `${base}${path}`;
  }, [selectedPath]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      if (!endpoint) throw new Error("Webhook URL not configured. Check your .env values.");

      const payload = {
        youtubeUrl: youtubeUrl.trim(),
        maxClipLength: Number(maxClipLength),
        aspectRatio,
        removeFillerWords,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: ApiResponse | null = null;
      try {
        data = text ? (JSON.parse(text) as ApiResponse) : ({} as ApiResponse);
      } catch {
        console.warn("Non-JSON response from API.");
      }

      if (!res.ok) {
        setError(`Request failed (${res.status}): ${res.statusText}`);
      }
      if (data) setResponse(data);
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(caption: string, idx: number) {
    const ok = await copyToClipboard(caption ?? "");
    if (ok) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1200);
    }
  }

  const clipUrl = (c: Clip) => c.file || c.videoUrl || c.url || "#";
  const clipCaption = (c: Clip) => c.caption ?? c.text ?? "";

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">Repurposer UI v3 — YouTube → Clips</h1>
        <p className="subtitle">Submit a YouTube URL, choose options, and generate clip candidates.</p>
      </header>

      <main className="main-card" aria-live="polite">
        <section className="section">
          <form onSubmit={onSubmit} className="form-grid">
            <div className="form-row">
              <label htmlFor="youtube">YouTube URL</label>
              <input
                id="youtube"
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <label htmlFor="maxlen">Max Clip Length (seconds)</label>
              <input
                id="maxlen"
                type="number"
                min={10}
                max={180}
                step={5}
                value={maxClipLength}
                onChange={(e) => setMaxClipLength(Number(e.target.value))}
                required
              />
            </div>

            <div className="form-row">
              <label htmlFor="ratio">Aspect Ratio</label>
              <select id="ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)}>
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
              </select>
            </div>

            <div className="checkbox-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={removeFillerWords}
                  onChange={(e) => setRemoveFillerWords(e.target.checked)}
                />
                Remove Filler Words
              </label>

              <div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={useActiveWorkflow}
                    onChange={(e) => setUseActiveWorkflow(e.target.checked)}
                  />
                  Use Active Workflow
                </label>
                <div className="small-note">Endpoint: <code>{endpoint || "Missing .env vars"}</code></div>
              </div>
            </div>

            <div className="actions">
              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Processing…" : "Submit"}
              </button>
            </div>
          </form>
        </section>

        <hr className="divider" />

        <section className="section">
          {error && <div className="error-box" role="alert">{error}</div>}

          {response && (
            <div className="results" style={{ marginTop: error ? 14 : 0 }}>
              <div className="panel" aria-label="Raw JSON">
                <pre className="json">{JSON.stringify(response, null, 2)}</pre>
              </div>

              <div className="panel" aria-label="Clip Cards">
                <div className="clip-grid">
                  {(response.clips ?? []).map((clip, idx) => (
                    <article className="clip-card" key={idx}>
                      <div className="clip-header">
                        <a className="clip-link" href={clipUrl(clip)} target="_blank" rel="noreferrer noopener">
                          Open clip ↗
                        </a>
                        <button
                          className="copy"
                          type="button"
                          onClick={() => handleCopy(clipCaption(clip), idx)}
                          aria-live="polite"
                        >
                          {copiedIdx === idx ? "Copied" : "Copy caption"}
                        </button>
                      </div>
                      <div className="caption">{clipCaption(clip) || <i style={{ color: "#999" }}>No caption</i>}</div>
                    </article>
                  ))}
                  {(!response.clips || response.clips.length === 0) && (
                    <div style={{ color: "#777", fontSize: 13 }}>No clips returned.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!error && !response && (
            <footer className="footer-note">Results will appear here after submission.</footer>
          )}
        </section>
      </main>
    </div>
  );
}
