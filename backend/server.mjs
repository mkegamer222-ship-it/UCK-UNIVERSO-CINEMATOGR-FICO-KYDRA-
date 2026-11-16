#!/usr/bin/env node
/**
 * backend/server.mjs — servidor estático + API mínima do Kydra Launcher.
 *
 * Sobe a interface (raiz do repositório) em http://0.0.0.0:8787 e expõe /api:
 *   GET  /api/health    → { ok, mode }
 *   GET  /api/versions  → catálogo de builds (lê o catálogo compartilhado)
 *   POST /api/install   → { id }   (stub: registra intenção, sem rede)
 *   POST /api/prepare   → { id }
 *   POST /api/play      → { buildId, instanceId }
 *
 * Sem dependências: só o runtime do Node. Se o backend não responder, a
 * interface cai sozinha no modo demonstração (localStorage).
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

/** Lê o catálogo compartilhado com a interface (uma fonte de verdade). */
async function catalog() {
  const raw = await fs.readFile(path.join(ROOT, "src/js/data/builds.json"), "utf8");
  return JSON.parse(raw);
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
    "cache-control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function serveStatic(req, res, pathname) {
  const rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const file = path.join(ROOT, rel);

  // Não sai da raiz do repositório.
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, "index.html")) {
    res.writeHead(403).end("forbidden");
    return;
  }

  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) throw new Error("dir");
    const ext = path.extname(file).toLowerCase();
    const data = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "content-length": data.length,
      // O preview roda em outro host/porta: libera o embed.
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=120",
      "x-content-type-options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 — não encontrado");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const { pathname } = url;

  // O app é um SPA por hash, então só a raiz serve HTML.

  if (pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      mode: "backend",
      launcher: "kydra/0.1.0",
      platform: `${process.platform}/${process.arch}`,
      node: process.version,
    });
  }

  if (pathname === "/api/versions" && req.method === "GET") {
    return json(res, 200, { versions: await catalog() });
  }

  if (pathname === "/api/install" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, 202, {
      ok: true,
      queued: "install",
      id: body.id ?? null,
      note: "stub: o backend Rust baixa e verifica o tarball da release",
    });
  }

  if (pathname === "/api/prepare" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, 202, {
      ok: true,
      queued: "prepare",
      id: body.id ?? null,
      note: "stub: horizon-prepare reaproveita jars verificados por checksum",
    });
  }

  if (pathname === "/api/play" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, 202, {
      ok: true,
      queued: "play",
      buildId: body.buildId ?? null,
      instanceId: body.instanceId ?? null,
      pid: null,
      note: "stub: o backend Rust faz spawn do horizon-client",
    });
  }

  if (pathname.startsWith("/api/")) {
    return json(res, 404, { error: "rota inexistente" });
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Kydra Launcher → http://${HOST}:${PORT}`);
});
