/**
 * store.js — estado do launcher + persistência local + backend simulado.
 *
 * Duas camadas, de propósito:
 *   1. `api`  — fala HTTP com o backend Rust (`backend/`, porta 8787). Se estiver
 *               de pé, é ele quem manda (builds reais, prepare real, spawn real).
 *   2. `demo` — simulação em memória com localStorage, usada quando o backend não
 *               responde. É o modo que roda no preview do navegador.
 *
 * Qualquer view só conversa com `store`, nunca com `api`/`demo` direto.
 */

import { builds as CATALOG, patches, roadmap, mods, modpacks } from "./data/builds.js";
import { delay, fmtBytes } from "./ui.js";

const LS_KEY = "kydra.launcher.v1";
const API_BASE = "/api";

const DEFAULTS = {
  settings: {
    autoInstall: true,
    channel: "stable", // stable | nightly
    opening: true,
    gameMenus: "kydra", // kydra | classic
    gameArgs: "",
    memory: 4096,
    java: "auto",
    appearance: "dark", // dark | light
    reduceMotion: false,
    telemetry: { perf: false, crashes: false, bugs: false, benchmarks: false, asked: false },
    instanceDir: "~/Kydra/instances",
    dataDir: "~/.local/share/kydra",
  },
  account: null, // { name, uuid, type: "offline" | "microsoft" }
  installed: {}, // id -> { installedAt, sizeBytes, prepared, instance }
  instances: [
    { id: "default", name: "Kydra", group: "Principal", color: "#3ee07f", playtimeMs: 0, lastPlayed: null },
  ],
  selectedBuild: null,
  selectedInstance: "default",
  activeTab: "play",
  consoleOpen: false,
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...saved,
      settings: { ...DEFAULTS.settings, ...(saved.settings || {}), telemetry: { ...DEFAULTS.settings.telemetry, ...(saved.settings?.telemetry || {}) } },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const state = load();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(reason = "change") {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* quota cheia: o estado continua em memória */
  }
  listeners.forEach((fn) => fn(state, reason));
}

export function set(patch, reason) {
  deepAssign(state, patch);
  emit(reason);
}

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object" && !Array.isArray(target[k])) {
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

/* ========================================================================
   Backend real
   ====================================================================== */
let backendUp = null; // null = ainda não testado

async function http(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const backend = {
  async probe() {
    if (backendUp !== null) return backendUp;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      backendUp = res.ok;
    } catch {
      backendUp = false;
    }
    return backendUp;
  },
  get mode() {
    return backendUp ? "backend" : "demo";
  },
};

/* ========================================================================
   Simulação (demo) — mesmo contrato do backend
   ====================================================================== */
const demo = {
  versions: () => CATALOG,

  installedList: () => Object.entries(state.installed).map(([id, v]) => ({ id, ...v })),

  async install(id, onLog) {
    const build = CATALOG.find((b) => b.id === id);
    if (!build) throw new Error("build inexistente");
    const steps = [
      `GET  https://api.github.com/repos/horizon-rust/horizon/releases/tags/${id}`,
      `baixando horizon-client-${build.version}-linux-x86_64.tar.gz (${fmtBytes(build.sizeBytes)})`,
      "verificando sha256 … ok",
      "extraindo em ~/.local/share/kydra/versions/" + id,
      "gravando version.json",
    ];
    let pct = 0;
    for (const step of steps) {
      onLog?.(step, step.includes("ok") ? "ok" : "");
      const slices = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < slices; i += 1) {
        await delay(28 + Math.random() * 46);
        pct = Math.min(100, pct + 100 / (steps.length * slices));
        onLog?.({ progress: pct });
      }
    }
    state.installed[id] = {
      installedAt: new Date().toISOString(),
      sizeBytes: build.sizeBytes,
      version: build.version,
      prepared: false,
    };
    if (!state.selectedBuild) state.selectedBuild = id;
    emit("install");
    return { ok: true };
  },

  async remove(id, onLog) {
    onLog?.(`removendo ~/.local/share/kydra/versions/${id}`, "dim");
    await delay(420);
    delete state.installed[id];
    if (state.selectedBuild === id) state.selectedBuild = Object.keys(state.installed)[0] ?? null;
    emit("remove");
    return { ok: true };
  },

  async prepare(id, onLog) {
    const build = CATALOG.find((b) => b.id === id);
    const steps = [
      "procurando a instalação do Minecraft 26.3 no seu launcher oficial",
      "client-26.3.jar  ✓ sha1 confere",
      "bibliotecas do sistema  ✓ 14 de 14",
      "assets/indexes/26.json e objects  ✓ 3 218 arquivos",
      "copiando sounds para o asset store do Horizon",
      `prepare concluído para ${build?.version ?? id}`,
    ];
    for (const step of steps) {
      await delay(320 + Math.random() * 380);
      onLog?.(step, step.includes("✓") || step.startsWith("prepare") ? "ok" : "");
    }
    if (state.installed[id]) state.installed[id].prepared = true;
    emit("prepare");
    return { ok: true };
  },

  async play({ buildId, instanceId }, onLog) {
    const build = CATALOG.find((b) => b.id === buildId);
    onLog?.(`lançando horizon-client ${build?.version ?? buildId}`, "ok");
    onLog?.(`--instance ${instanceId} --memory ${state.settings.memory}M ${state.settings.gameArgs}`.trim(), "dim");
    await delay(300);
    onLog?.("JVM desktop / wgpu: adaptador escolhido", "dim");
    await delay(600);
    onLog?.("carregando mundo (single-player na thread do servidor)", "dim");
    return { ok: true, pid: 10_000 + Math.floor(Math.random() * 50_000) };
  },
};

/* ========================================================================
   store — fachada única
   ====================================================================== */
export const store = {
  get state() {
    return state;
  },

  /* --- catálogo --------------------------------------------------------- */
  async versions() {
    if (await backend.probe()) {
      try {
        const data = await http("/versions");
        return data.versions;
      } catch {
        /* cai no catálogo */
      }
    }
    return demo.versions();
  },

  patches: () => patches,
  roadmap: () => roadmap,
  mods: () => mods,
  modpacks: () => modpacks,

  /* --- seleção ---------------------------------------------------------- */
  selectBuild(id) {
    state.selectedBuild = id;
    emit("select-build");
  },
  selectInstance(id) {
    state.selectedInstance = id;
    emit("select-instance");
  },
  setTab(tab) {
    state.activeTab = tab;
    emit("tab");
  },

  /* --- conta ------------------------------------------------------------ */
  signIn(name) {
    state.account = {
      name: name.trim(),
      uuid: fakeUuid(name),
      type: "offline",
    };
    emit("account");
  },
  signOut() {
    state.account = null;
    emit("account");
  },

  /* --- instalação ------------------------------------------------------- */
  async install(id, onLog) {
    if (await backend.probe()) {
      try {
        await http("/install", { method: "POST", body: JSON.stringify({ id }) });
        emit("install");
        return { ok: true };
      } catch (err) {
        onLog?.(`backend falhou (${err.message}); seguindo em demonstração`, "warn");
      }
    }
    return demo.install(id, onLog);
  },

  async remove(id, onLog) {
    return demo.remove(id, onLog);
  },

  async prepare(id, onLog) {
    if (await backend.probe()) {
      try {
        await http("/prepare", { method: "POST", body: JSON.stringify({ id }) });
      } catch {
        /* segue no demo */
      }
    }
    return demo.prepare(id, onLog);
  },

  async play(payload, onLog) {
    if (!state.account) throw new Error("entre na sua conta para jogar");
    if (await backend.probe()) {
      try {
        return await http("/play", { method: "POST", body: JSON.stringify(payload) });
      } catch {
        /* segue no demo */
      }
    }
    const res = await demo.play(payload, onLog);
    const inst = state.instances.find((i) => i.id === payload.instanceId);
    if (inst) {
      inst.lastPlayed = new Date().toISOString();
      inst.playtimeMs = (inst.playtimeMs || 0) + 60_000 * 25;
    }
    emit("play");
    return res;
  },

  /* --- instâncias ------------------------------------------------------- */
  addInstance({ name, group = "Principal", color = "#3ee07f" }) {
    const id = `inst-${Date.now().toString(36)}`;
    state.instances.push({ id, name, group, color, playtimeMs: 0, lastPlayed: null });
    emit("instance-add");
    return id;
  },
  updateInstance(id, patch) {
    const inst = state.instances.find((i) => i.id === id);
    if (!inst) return;
    Object.assign(inst, patch);
    emit("instance-update");
  },
  removeInstance(id) {
    state.instances = state.instances.filter((i) => i.id !== id);
    if (state.selectedInstance === id) state.selectedInstance = state.instances[0]?.id ?? "default";
    emit("instance-remove");
  },

  /* --- configurações ---------------------------------------------------- */
  setSetting(key, value) {
    state.settings[key] = value;
    emit("settings");
  },
  setTelemetry(key, value) {
    state.settings.telemetry[key] = value;
    state.settings.telemetry.asked = true;
    emit("settings");
  },

  /* --- derivados -------------------------------------------------------- */
  installedBuilds() {
    return Object.keys(state.installed);
  },
  isInstalled: (id) => Boolean(state.installed[id]),
  currentBuild(list) {
    const all = list ?? CATALOG;
    return all.find((b) => b.id === state.selectedBuild) ?? all[0] ?? null;
  },
  currentInstance() {
    return state.instances.find((i) => i.id === state.selectedInstance) ?? state.instances[0] ?? null;
  },
  newestInstalled(list) {
    const all = list ?? CATALOG;
    return all.find((b) => state.installed[b.id]) ?? null;
  },
};

function fakeUuid(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) ^ 0x9e3779b9;
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  return `${hex}-1111-4${hex.slice(0, 3)}-8${hex.slice(0, 3)}-${hex}${hex.slice(0, 4)}`.slice(0, 36);
}
