/**
 * tests/smoke.test.mjs — sobe a interface num DOM (jsdom) e confere que as
 * rotas renderizam, que os fluxos principais respondem e que nenhum erro de
 * script aparece.
 *
 * Os módulos ES são importados de verdade (mesmos arquivos que o navegador
 * carrega); só o DOM é simulado.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera uma condição virar verdadeira (instalações simuladas levam segundos). */
async function waitFor(fn, timeout = 15000, step = 60) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(step);
  }
  return false;
}

/** Instala window/document globais e devolve o DOM pronto. */
async function makeDom(route = "play") {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(`${e.message}${e.detail ? ` — ${e.detail}` : ""}`));
  vc.on("error", (...m) => errors.push(m.join(" ")));

  const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: `http://localhost:8787/#/${route}`,
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  const { window } = dom;
  // jsdom não tem fetch nem clipboard; o app trata a ausência de backend.
  window.fetch = async () => {
    throw new Error("sem backend no teste");
  };
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: async () => {} },
    configurable: true,
  });

  const define = (key, value) =>
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });

  define("window", window);
  define("document", window.document);
  define("localStorage", window.localStorage);
  define("navigator", window.navigator);
  define("HTMLElement", window.HTMLElement);
  define("Node", window.Node);
  define("Event", window.Event);
  define("CustomEvent", window.CustomEvent);
  define("getComputedStyle", window.getComputedStyle.bind(window));
  define("location", window.location);
  define("history", window.history);

  return { dom, window, doc: window.document, errors };
}

/** Importa o app com cache-busting para cada teste ter seu próprio estado. */
async function boot(route = "play") {
  const env = await makeDom(route);
  await import(`../src/js/app.js?t=${Date.now()}-${Math.random()}`);
  await sleep(90);
  // Cada teste fecha o próprio DOM no final (evita timers pendurados).
  const prevClose = env.window.close.bind(env.window);
  env.close = () => {
    try {
      prevClose();
    } catch {
      /* já fechado */
    }
  };
  return env;
}

const click = (el) => {
  assert.ok(el, "elemento para clicar existe");
  const { MouseEvent } = globalThis.window;
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

test("a página Play renderiza o herói, as dependências e o botão Jogar", async () => {
  const { doc, errors, close } = await boot("play");
  assert.ok(doc.querySelector(".hero__title"), "título do herói");
  assert.match(doc.querySelector(".hero__blurb").textContent, /Horizon v2026/);
  assert.ok(doc.querySelector("#playBtn"), "botão Jogar");
  assert.ok(doc.querySelectorAll("#deps .row").length >= 3, "linhas de dependência");
  assert.ok(doc.querySelector("#buildPick option"), "seletor de versão populado");
  assert.deepEqual(errors, []);
});

test("todas as rotas renderizam sem erro de script", async () => {
  const routes = ["versions", "notes", "next", "mods", "instances", "servers", "settings"];
  for (const r of routes) {
    const { doc, errors, close } = await boot(r);
    assert.ok(doc.querySelector(".page__title"), `título em #/${r}`);
    assert.equal(
      doc.querySelectorAll(".nav__item.is-active").length,
      1,
      `um item ativo na sidebar em #/${r}`
    );
    assert.deepEqual(errors, [], `sem erro de script em #/${r}`);
    close();
  }
});

test("versões: instalar uma build marca como instalada e aparece em uso", async () => {
  const { doc, window, close } = await boot("versions");
  await sleep(30);
  const rows = () => doc.querySelectorAll("#list .build-row");
  assert.ok(rows().length === 8, "catálogo completo listado");

  click(doc.querySelector('[data-install="v20261110"]'));
  const done = await waitFor(() => doc.querySelector('[data-remove="v20261110"]'));
  assert.ok(done, "instalação termina e o botão Remover aparece");
  assert.match(doc.querySelector("#list").textContent, /instalada/);
  assert.equal(window.localStorage.getItem("kydra.launcher.v1").includes("v20261110"), true);
  close();
});

test("versões: filtro por canal funciona", async () => {
  const { doc, close } = await boot("versions");
  await sleep(30);
  click(doc.querySelector('[data-filter="nightly"]'));
  const tags = [...doc.querySelectorAll("#list .build-row")].map((r) => r.textContent);
  assert.ok(tags.length === 3, "três nightlies no catálogo");
  assert.ok(tags.every((t) => t.includes("Nightly")));
});

test("conta: entrar com nome offline atualiza a barra lateral", async () => {
  const { doc, close } = await boot("play");
  click(doc.querySelector("#accountBtn"));
  await sleep(20);
  const input = doc.querySelector("#acc-name");
  assert.ok(input, "campo de nome no modal");
  input.value = "Kydra";
  click(doc.querySelector("[data-modal-ok]"));
  await sleep(40);
  assert.match(doc.querySelector("#accountBtn").textContent, /Kydra/);
});

test("ajustes: alternar um switch persiste no estado", async () => {
  const { doc, window, close } = await boot("settings");
  const toggle = doc.querySelector('[data-toggle="autoInstall"]');
  assert.equal(toggle.getAttribute("aria-checked"), "true");
  click(toggle);
  await sleep(30);
  const saved = JSON.parse(window.localStorage.getItem("kydra.launcher.v1"));
  assert.equal(saved.settings.autoInstall, false);
});

test("ajustes: trocar o tema muda o atributo do documento", async () => {
  const { doc, window, close } = await boot("settings");
  click(doc.querySelector('[data-appearance="light"]'));
  await sleep(30);
  assert.equal(doc.documentElement.dataset.theme, "light");
});

test("servidores: criar um servidor exige o EULA e depois lista o servidor", async () => {
  const { doc, close } = await boot("servers");
  click(doc.querySelector('[data-new="vanilla"]'));
  await sleep(20);
  doc.querySelector("#s-name").value = "Sexta";
  // sem marcar o EULA não cria
  click(doc.querySelector("[data-modal-ok]"));
  await sleep(20);
  assert.equal(doc.querySelectorAll("[data-console]").length, 1, "só o servidor inicial");

  doc.querySelector("#s-eula").checked = true;
  click(doc.querySelector("[data-modal-ok]"));
  await sleep(30);
  assert.equal(doc.querySelectorAll("[data-console]").length, 2, "servidor criado");
  assert.match(doc.querySelector("#running").textContent, /Sexta/);
});

test("servidores: iniciar e parar alternam o estado", async () => {
  const { doc, close } = await boot("servers");
  click(doc.querySelector('[data-stop="friday-night"]'));
  await sleep(20);
  assert.ok(doc.querySelector('[data-start="friday-night"]'), "aparece Iniciar");
  click(doc.querySelector('[data-start="friday-night"]'));
  await sleep(800);
  assert.ok(doc.querySelector('[data-stop="friday-night"]'), "volta para Parar");
});

test("instâncias: criar uma instância nova adiciona ao grid", async () => {
  const { doc, close } = await boot("instances");
  const before = doc.querySelectorAll(".inst").length;
  click(doc.querySelector("#newInst"));
  await sleep(20);
  doc.querySelector("#i-name").value = "Hardcore";
  click(doc.querySelector("[data-modal-ok]"));
  await sleep(30);
  assert.equal(doc.querySelectorAll(".inst").length, before + 1);
  assert.match(doc.querySelector("#grid").textContent, /Hardcore/);
});

test("mods: busca filtra o catálogo", async () => {
  const { doc, close } = await boot("mods");
  const before = doc.querySelectorAll(".mod").length;
  assert.ok(before === 6);
  const search = doc.querySelector("#modSearch");
  search.value = "sodium";
  search.dispatchEvent(new globalThis.window.Event("input", { bubbles: true }));
  await sleep(20);
  assert.equal(doc.querySelectorAll(".mod").length, 1);
  assert.match(doc.querySelector(".mod").textContent, /Sodium/);
});

test("o backend é detectado como ausente e o modo demo assume", async () => {
  const { doc, close } = await boot("versions");
  await sleep(60);
  assert.ok(doc.querySelectorAll(".build-row").length > 0, "catálogo embutido usado");
});
