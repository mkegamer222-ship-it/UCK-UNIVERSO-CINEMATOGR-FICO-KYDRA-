/**
 * tests/backend.test.mjs — contrato do backend e coerência entre as duas
 * implementações (Node e Rust).
 *
 * Não sobe processo: importa as rotas do Node e confere o que o Rust declara
 * no arquivo-fonte. Assim uma mudança de contrato quebra o teste, não o app.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (rel) => fs.readFile(path.join(ROOT, rel), "utf8");

test("o catálogo é JSON válido, ordenado do mais novo para o mais antigo", async () => {
  const builds = JSON.parse(await read("src/js/data/builds.json"));
  assert.ok(builds.length >= 8, "catálogo tem as 8 builds");
  const dates = builds.map((b) => b.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), "ordem decrescente por data");
  for (const b of builds) {
    assert.match(b.id, /^v\d{8}$/);
    assert.ok(["nightly", "stable"].includes(b.tag));
    assert.ok(b.parity >= 0 && b.parity <= 100, `parity de ${b.id}`);
    assert.ok(b.sizeBytes > 0 && b.harnesses > 0);
    assert.ok(Array.isArray(b.notes) && b.notes.length > 0);
  }
});

test("a interface lê o catálogo do mesmo arquivo que o backend", async () => {
  const js = await read("src/js/data/builds.js");
  assert.match(js, /import catalog from "\.\/builds\.json"/, "builds.js importa o JSON");
  const mod = await import(path.join(ROOT, "src/js/data/builds.js"));
  const json = JSON.parse(await read("src/js/data/builds.json"));
  assert.equal(mod.builds.length, json.length);
});

test("o backend Rust embute exatamente o mesmo catálogo", async () => {
  const rs = await read("backend-rust/src/main.rs");
  assert.match(
    rs,
    /include_str!\("\.\.\/\.\.\/src\/js\/data\/builds\.json"\)/,
    "include_str aponta para o catálogo compartilhado"
  );
});

test("os dois backends expõem as mesmas rotas documentadas", async () => {
  const nodeSrc = await read("backend/server.mjs");
  const rustSrc = await read("backend-rust/src/main.rs");
  const apiDoc = await read("docs/API.md");

  // Rust agrupa instalar/preparar/jogar numa braça só: ("install" | "prepare" | "play", "POST").
  const rustRoute = (name) => new RegExp(`"${name}"`).test(rustSrc);

  for (const route of ["health", "versions", "install", "prepare", "play"]) {
    assert.ok(nodeSrc.includes(`"/api/${route}"`), `Node expõe /api/${route}`);
    assert.ok(rustRoute(route), `Rust trata ${route}`);
    assert.ok(apiDoc.includes(`/api/${route}`), `docs/API.md documenta /api/${route}`);
  }
});

test("o servidor Node responde ao contrato em processo", async () => {
  const { spawn } = await import("node:child_process");
  const port = 8791;
  const child = spawn("node", ["backend/server.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("servidor não subiu")), 8000);
    child.stdout.on("data", (d) => {
      if (String(d).includes("http://")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  try {
    await ready;
    const base = `http://127.0.0.1:${port}`;

    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.mode, "backend");

    const versions = await (await fetch(`${base}/api/versions`)).json();
    assert.ok(versions.versions.length >= 8);
    assert.equal(versions.versions[0].id, "v20261116");

    const play = await fetch(`${base}/api/play`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buildId: "v20261116", instanceId: "default" }),
    });
    assert.equal(play.status, 202);
    assert.equal((await play.json()).queued, "play");

    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Kydra Launcher/);

    const notFound = await fetch(`${base}/nao-existe.html`);
    assert.equal(notFound.status, 404);

    // Não serve nada fora da raiz do projeto.
    const escape = await fetch(`${base}/../../etc/passwd`);
    assert.notEqual(escape.status, 200);
  } finally {
    child.kill();
  }
});
