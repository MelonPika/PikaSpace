import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

type SuggestEngine = "google" | "bing" | "duckduckgo" | "perplexity";

function normalizeSuggestions(values: unknown[], query: string) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const lowerQuery = query.toLowerCase();

  for (const value of values) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    if (!text || key === lowerQuery || seen.has(key)) continue;
    seen.add(key);
    normalized.push(text);
    if (normalized.length >= 10) break;
  }

  return normalized;
}

async function fetchGoogleSuggestions(query: string, signal: AbortSignal) {
  const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`, {
    signal,
    headers: { "User-Agent": "PikaNav/0.1" },
  });
  const data = await response.json();
  return normalizeSuggestions(Array.isArray(data?.[1]) ? data[1] : [], query);
}

function suggestionProxy() {
  return {
    name: "suggestion-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/suggest", async (req: any, res: any) => {
        const url = new URL(req.url || "", "http://localhost");
        const query = (url.searchParams.get("q") || "").trim();
        const engine = (url.searchParams.get("engine") || "google") as SuggestEngine;

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "private, max-age=60");

        if (!query) {
          res.end(JSON.stringify({ suggestions: [] }));
          return;
        }
        if (engine === "perplexity") {
          res.end(JSON.stringify({ suggestions: [] }));
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        try {
          let suggestions: string[] = [];
          if (engine === "bing") {
            const response = await fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`, {
              signal: controller.signal,
              headers: { "User-Agent": "PikaNav/0.1" },
            });
            const data = await response.json();
            suggestions = normalizeSuggestions(Array.isArray(data?.[1]) ? data[1] : [], query);
          } else if (engine === "duckduckgo") {
            const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`, {
              signal: controller.signal,
              headers: { "User-Agent": "PikaNav/0.1" },
            });
            const data = await response.json();
            suggestions = normalizeSuggestions(Array.isArray(data) ? data.map((item) => item?.phrase) : [], query);
          } else {
            suggestions = await fetchGoogleSuggestions(query, controller.signal);
          }

          res.end(JSON.stringify({ suggestions }));
        } catch (error) {
          res.statusCode = 502;
          res.end(JSON.stringify({ suggestions: [], error: "Suggestion service unavailable" }));
        } finally {
          clearTimeout(timeout);
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [suggestionProxy(), react()],
});
