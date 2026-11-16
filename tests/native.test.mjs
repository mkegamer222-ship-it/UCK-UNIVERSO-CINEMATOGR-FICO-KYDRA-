/**
 * tests/native.test.mjs — o executável nativo funciona sozinho?
 *
 * Copia o binário Linux (mesmo núcleo do kydra.exe) para uma pasta VAZIA,
 * roda e confere que a interface inteira sai de dentro dele: HTML, módulos,
 * CSS, catálogo e imagem. É o que garante que o .exe do Windows não dependa
 * de nenhum arquivo ao lado.
 *
 *   node --test tests/native.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const require_net = () => net;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN = path.join(ROOT, "dist/linux/kydra-linux-x64");
const PORT = 8823;

async function withBinary(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kydra-iso-"));
  const bin = path.join(dir, "kydra");
  await fs.copyFile(BIN, bin);
  await fs.chmod(bin, 0o755);

  // A pasta tem SÓ o binário: nada de src/, assets/ ou index.html.
  const child = spawn(bin, ["--port", String(PORT)], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("binário não subiu")), 8000);
    child.stdout.on("data", (d) => {
      if (String(d).includes("http://")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  try {
    await fn(`http://127.0.0.1:${PORT}`, dir);
  } finally {
    child.kill();
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("o binário existe (tools/build-exe.sh rodou)", async () => {
  await assert.doesNotReject(fs.access(BIN), "dist/linux/kydra-linux-x64 não existe");
});

test("serve a interface a partir de uma pasta vazia", async () => {
  await withBinary(async (base, dir) => {
    const files = [
      ["/", "text/html"],
      ["/src/js/app.js", "text/javascript"],
      ["/src/styles/tokens.css", "text/css"],
      ["/src/js/data/builds.json", "application/json"],
      ["/src/assets/logo.svg", "image/svg+xml"],
      ["/assets/hero-aurora.jpg", "image/jpeg"],
    ];

    for (const [p, mime] of files) {
      const res = await fetch(base + p);
      assert.equal(res.status, 200, `${p} deveria sair do executável`);
      assert.ok(res.headers.get("content-type").includes(mime), `${p} tem MIME ${mime}`);
      assert.ok((await res.arrayBuffer()).byteLength > 0, `${p} não veio vazio`);
    }

    // Só o binário estava na pasta.
    const entries = await fs.readdir(dir);
    assert.deepEqual(entries.sort(), ["kydra"]);
  });
});

test("a API responde e valida o método", async () => {
  await withBinary(async (base) => {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.assets, 23);

    const versions = await (await fetch(`${base}/api/versions`)).json();
    assert.ok(versions.versions.length >= 8, "catálogo completo");
    assert.equal(versions.versions[0].id, "v20261116");

    const play = await fetch(`${base}/api/play`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buildId: "v20261116" }),
    });
    assert.equal(play.status, 202);
    assert.equal((await play.json()).id, "v20261116");

    const wrongMethod = await fetch(`${base}/api/play`);
    assert.equal(wrongMethod.status, 405);

    const missing = await fetch(`${base}/api/nao-existe`, { method: "POST" });
    assert.equal(missing.status, 404);
  });
});

test("não serve nada que não esteja embutido", async () => {
  await withBinary(async (base) => {
    for (const p of ["/README.md", "/package.json", "/docs/API.md", "/native/src/main.c", "/%2e%2e%2fetc%2fpasswd"]) {
      const res = await fetch(base + p);
      assert.equal(res.status, 404, `${p} não deveria ser servido`);
    }

    // Cliente cru: ".." no caminho precisa morrer em 404, não escapar da lista.
    const raw = await new Promise((resolve, reject) => {
      const net = require_net();
      const sock = net.connect(PORT, "127.0.0.1", () => {
        sock.write("GET /../../etc/passwd HTTP/1.1\r\nHost: x\r\n\r\n");
      });
      let out = "";
      sock.on("data", (d) => (out += d));
      sock.on("end", () => resolve(out));
      sock.on("error", reject);
      setTimeout(() => sock.destroy(), 3000);
    });
    assert.match(raw, /^HTTP\/1\.1 404/, "traversal não pode vazar arquivo");
  });
});
