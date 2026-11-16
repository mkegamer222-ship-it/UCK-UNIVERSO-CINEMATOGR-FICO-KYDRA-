/**
 * views/play.js — página inicial: o herói com a build atual, Jogar,
 * preparar recursos, escolher versão/instância e o log da sessão.
 *
 * Espelha a página Play do launcher do Horizon: título grande, uma linha de
 * verdade por vez (recursos, pasta do Minecraft, instância) e um único botão
 * primário.
 */

import { icon } from "../icons.js";
import { store } from "../store.js";
import { esc, fmtBytes, fmtDate, toast } from "../ui.js";
import { consoleShow, consoleWrite, consoleClear } from "../ui.js";

const DEPS = [
  { id: "resources", label: "Recursos do jogo", hint: "Precisa dos arquivos do seu Minecraft 26.3." },
  { id: "minecraft", label: "Pasta do Minecraft", hint: "Usamos o que o launcher oficial já baixou." },
  { id: "java", label: "Java 25", hint: "Runtime exigido pelo Horizon." },
];

export function playView(root) {
  let versions = [];
  let busy = false;

  root.innerHTML = `
    <div class="hero">
      <div class="hero__bg" role="img" aria-label="Aurora verde sobre uma floresta de blocos"></div>
      <div class="hero__veil"></div>
      <div class="hero__inner">
        <div class="hero__meta" id="heroMeta"></div>
        <h1 class="hero__title">Kydra</h1>
        <p class="hero__blurb" id="heroBlurb"></p>
        <div class="hero__update" id="heroUpdate"></div>

        <div class="hero__controls">
          <div class="hero__modes" role="group" aria-label="Modo">
            <button class="pills__item is-active" data-mode="client" type="button">Cliente</button>
            <button class="pills__item" data-mode="server" type="button">Servidor</button>
          </div>
          <div class="hero__right">
            <div class="hero__pickers">
              <label class="sr-only" for="buildPick">Versão</label>
              <select class="input hero__select" id="buildPick"></select>
              <label class="sr-only" for="instPick">Instância</label>
              <select class="input hero__select" id="instPick"></select>
            </div>
            <button class="btn btn--primary btn--play" id="playBtn" type="button">
              ${icon("play", { size: 15 })}<span>Jogar</span>
            </button>
          </div>
        </div>

        <div class="hero__progress" id="heroProgress" hidden>
          <div class="progress"><div class="progress__bar" style="width:0%"></div></div>
          <span class="xs muted mono" id="heroProgressText">0%</span>
        </div>
      </div>
    </div>

    <div class="page__inner">
      <section class="rows" id="deps" aria-label="O que falta para jogar"></section>

      <section class="play-grid" id="playGrid"></section>
    </div>
  `;

  const heroMeta = root.querySelector("#heroMeta");
  const heroBlurb = root.querySelector("#heroBlurb");
  const heroUpdate = root.querySelector("#heroUpdate");
  const buildPick = root.querySelector("#buildPick");
  const instPick = root.querySelector("#instPick");
  const playBtn = root.querySelector("#playBtn");
  const progressWrap = root.querySelector("#heroProgress");
  const progressBar = progressWrap.querySelector(".progress__bar");
  const progressText = root.querySelector("#heroProgressText");

  /* --- dados ------------------------------------------------------------ */
  async function load() {
    versions = await store.versions();
    if (!store.state.selectedBuild) {
      store.state.selectedBuild = versions[0]?.id ?? null;
    }
    paint();
  }

  function current() {
    return store.currentBuild(versions);
  }

  function paint() {
    const build = current();
    const inst = store.currentInstance();
    const installed = build ? store.isInstalled(build.id) : false;
    const prepared = build ? Boolean(store.state.installed[build.id]?.prepared) : false;

    if (build) {
      heroMeta.innerHTML = `
        <span>Minecraft 26.3</span><span class="sep">·</span>
        <span>${installed ? (prepared ? "Pronta para jogar" : "Precisa preparar") : "Não instalada"}</span>
        <span class="chip chip--${build.tag === "nightly" ? "warn" : "accent"}">${build.tag === "nightly" ? "Nightly" : "Estável"}</span>`;
      heroBlurb.innerHTML = `Horizon <span class="mono">v${esc(build.version)}</span> — Minecraft: Java Edition reescrito em Rust, conferido contra o jogo original com ${build.harnesses} harnesses diferenciais. Parity: <strong>${build.parity}%</strong>.`;
    }

    const newer = versions.find((v) => v.tag === "stable" && !store.isInstalled(v.id));
    heroUpdate.innerHTML =
      newer && installed
        ? `<span class="status status--ok"><span class="status__dot"></span>v${esc(newer.version)} disponível</span>
           <button class="linklike accent" data-install="${esc(newer.id)}" type="button">Instalar</button>`
        : "";

    buildPick.innerHTML = versions
      .map((v) => {
        const flag = store.isInstalled(v.id) ? " ✓" : "";
        const tag = v.tag === "nightly" ? "nightly" : "estável";
        return `<option value="${v.id}" ${v.id === store.state.selectedBuild ? "selected" : ""}>v${v.version} · ${tag}${flag}</option>`;
      })
      .join("");

    instPick.innerHTML = store.state.instances
      .map(
        (i) =>
          `<option value="${i.id}" ${i.id === store.state.selectedInstance ? "selected" : ""}>${esc(i.name)}</option>`
      )
      .join("");

    paintDeps(build, prepared);
    paintPlayGrid(build, inst);
    paintPlayBtn(build, prepared);
  }

  function paintDeps(build, prepared) {
    const installed = build ? store.isInstalled(build.id) : false;
    const rows = [
      {
        ...DEPS[0],
        ok: prepared,
        value: prepared ? `Pronto para v${esc(build?.version ?? "")}.` : installed ? "Ainda não preparado." : "Baixa junto com a build.",
        action: prepared ? null : installed ? { label: "Preparar", act: "prepare" } : { label: "Instalar", act: "install" },
      },
      {
        ...DEPS[1],
        ok: true,
        value: "Encontrada em ~/.minecraft (26.3).",
        action: { label: "Escolher…", act: "pickFolder", ghost: true },
      },
      {
        ...DEPS[2],
        ok: true,
        value: "Java 25.0.1 · Temurin",
        action: null,
      },
    ];

    root.querySelector("#deps").innerHTML = rows
      .map(
        (r) => `
        <div class="row row--hover dep">
          <span class="status ${r.ok ? "status--ok" : "status--warn"}"><span class="status__dot"></span></span>
          <div class="row__main">
            <div class="row__title">${esc(r.label)}</div>
            <div class="row__sub">${r.value}</div>
          </div>
          <div class="row__aside">
            ${
              r.action
                ? `<button class="btn ${r.action.ghost ? "btn--ghost" : "btn--outline"} btn--sm" data-act="${r.action.act}" type="button">${esc(r.action.label)}</button>`
                : `<span class="chip chip--plain">${icon("check", { size: 12 })} ok</span>`
            }
          </div>
        </div>`
      )
      .join("");
  }

  function paintPlayGrid(build, inst) {
    const totalMs = store.state.instances.reduce((a, i) => a + (i.playtimeMs || 0), 0);
    const hours = Math.round(totalMs / 3_600_000);
    const last = inst?.lastPlayed ? new Date(inst.lastPlayed) : null;

    root.querySelector("#playGrid").innerHTML = `
      <article class="panel play-card">
        <header class="panel__head">
          <h2 class="panel__title">Sua instância</h2>
          <button class="btn btn--ghost btn--sm" data-navigate="instances" type="button">Gerenciar ${icon("chevron", { size: 13 })}</button>
        </header>
        <div class="play-card__body">
          <div class="instance-badge" style="--badge:${inst?.color ?? "#3ee07f"}">${esc((inst?.name ?? "K")[0].toUpperCase())}</div>
          <div class="play-card__text">
            <div class="play-card__name">${esc(inst?.name ?? "Kydra")}</div>
            <div class="xs muted">${esc(inst?.group ?? "Principal")} · ${last ? `jogado ${last.toLocaleDateString("pt-BR")}` : "nunca jogado"}</div>
          </div>
          <div class="play-card__stat">
            <div class="mono" style="font-size:19px">${hours}h</div>
            <div class="kicker">tempo de jogo</div>
          </div>
        </div>
      </article>

      <article class="panel play-card">
        <header class="panel__head">
          <h2 class="panel__title">Download e prepare</h2>
          <span class="chip">Opcional</span>
        </header>
        <p class="panel__body">Se você não tem o Minecraft 26.3 instalado, o Kydra baixa da Mojang para uma conta que possua o jogo — arquivo por arquivo, conferindo tamanho e SHA-1. Nada vem de espelho.</p>
        <div class="panel__foot">
          <button class="btn btn--outline btn--sm" data-act="download" type="button">${icon("download", { size: 13 })} Baixar da Mojang</button>
          <span class="xs muted">${build ? fmtBytes(build.sizeBytes) : "—"} · ${build ? fmtDate(build.date) : ""}</span>
        </div>
      </article>

      <article class="panel play-card play-card--wide">
        <header class="panel__head">
          <h2 class="panel__title">Sessão</h2>
          <button class="btn btn--ghost btn--sm" id="openConsole" type="button">${icon("terminal", { size: 13 })} Console</button>
        </header>
        <pre class="mini-log" id="miniLog"><span class="dim">Aguardando — clique em Jogar para ver o log aqui.</span></pre>
      </article>
    `;
  }

  let mode = "client";

  function paintPlayBtn(build, prepared) {
    const label = playBtn.querySelector("span");
    const installed = build ? store.isInstalled(build.id) : false;
    playBtn.disabled = !build || busy;
    if (mode === "server") {
      label.textContent = installed ? "Iniciar servidor" : "Instalar e hospedar";
      return;
    }
    if (!installed) label.textContent = "Instalar e jogar";
    else if (!prepared) label.textContent = "Preparar e jogar";
    else label.textContent = "Jogar";
  }

  /* --- ações ------------------------------------------------------------ */
  function setBusy(on, pct) {
    busy = on;
    playBtn.classList.toggle("is-busy", on);
    buildPick.disabled = on;
    instPick.disabled = on;
    progressWrap.hidden = !on;
    if (on) {
      const indet = pct == null;
      progressWrap.querySelector(".progress").classList.toggle("progress--indet", indet);
      if (!indet) {
        progressBar.style.width = `${Math.round(pct)}%`;
        progressText.textContent = `${Math.round(pct)}%`;
      } else {
        progressBar.style.width = "35%";
        progressText.textContent = "trabalhando…";
      }
    }
  }

  function log(line, kind) {
    const mini = root.querySelector("#miniLog");
    if (mini && line && typeof line === "string") {
      if (mini.dataset.fresh !== "1") {
        mini.innerHTML = "";
        mini.dataset.fresh = "1";
      }
      mini.insertAdjacentHTML("beforeend", `\n<span class="${kind ?? ""}">${esc(line)}</span>`);
      mini.scrollTop = mini.scrollHeight;
    }
    if (typeof line === "string") consoleWrite(line, kind ?? "");
    else if (line && typeof line.progress === "number") setBusy(true, line.progress);
  }

  async function runInstall(id) {
    busy = true;
    consoleClear();
    consoleShow(`Instalando v${versions.find((v) => v.id === id)?.version ?? id}`);
    setBusy(true, null);
    consoleWrite(`kydra install ${id}`, "dim");
    try {
      await store.install(id, log);
      toast("Build instalada");
    } catch (err) {
      consoleWrite(`falhou: ${err.message}`, "err");
      toast("A instalação falhou", "err");
    } finally {
      busy = false;
      setBusy(false);
      paint();
    }
  }

  async function runPrepare(id) {
    busy = true;
    setBusy(true, null);
    consoleShow("Preparando recursos");
    consoleWrite(`kydra prepare ${id}`, "dim");
    try {
      await store.prepare(id, log);
      toast("Recursos prontos");
    } catch (err) {
      consoleWrite(`falhou: ${err.message}`, "err");
    } finally {
      busy = false;
      setBusy(false);
      paint();
    }
  }

  async function runPlay() {
    const build = current();
    if (!build) return;
    if (!store.state.account) {
      toast("Entre na sua conta para jogar", "warn");
      document.querySelector("#accountBtn")?.click();
      return;
    }
    if (!store.isInstalled(build.id)) return runInstall(build.id);
    if (!store.state.installed[build.id].prepared) return runPrepare(build.id);

    busy = true;
    consoleClear();
    consoleShow("Horizon — sessão");
    setBusy(true, null);
    try {
      const res = await store.play({ buildId: build.id, instanceId: store.state.selectedInstance }, log);
      log(`processo ${res?.pid ?? "—"} em execução`, "ok");
      toast("Horizon iniciado — bom jogo");
      setTimeout(() => log("janela do jogo aberta (modo janela 1280×720)", "dim"), 900);
    } catch (err) {
      log(`falhou: ${err.message}`, "err");
      toast(err.message, "err");
    } finally {
      busy = false;
      setBusy(false);
      paint();
    }
  }

  /* --- eventos ---------------------------------------------------------- */
  root.addEventListener("change", (ev) => {
    if (ev.target === buildPick) {
      store.selectBuild(buildPick.value);
      paint();
    }
    if (ev.target === instPick) {
      store.selectInstance(instPick.value);
      paint();
    }
    if (ev.target === buildPick || ev.target === instPick) paint();
  });

  root.addEventListener("click", (ev) => {
    const modeBtn = ev.target.closest("[data-mode]");
    if (modeBtn) {
      mode = modeBtn.dataset.mode;
      root.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("is-active", b === modeBtn));
      paint();
      toast(mode === "server" ? "Modo servidor: a build sobe com horizon-server" : "Modo cliente");
      return;
    }

    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (act === "install") runInstall(current().id);
    if (act === "prepare") runPrepare(current().id);
    if (act === "pickFolder") toast("Seletor de pasta (no app desktop abre o Finder/Explorer)");
    if (act === "download") {
      toast("Download da Mojang exige conta Microsoft com o jogo", "warn");
      consoleShow("Download da Mojang");
      consoleWrite("piston-meta → version manifest", "dim");
    }

    const inst = ev.target.closest("[data-install]")?.dataset.install;
    if (inst) runInstall(inst);

    if (ev.target.closest("#playBtn")) {
      if (mode === "server") {
        consoleShow("Horizon — servidor");
        consoleWrite("horizon-server start --instance " + store.state.selectedInstance, "dim");
        consoleWrite("aguardando o painel em http://localhost:25565", "");
        toast("Servidor iniciando — veja em Servidores");
        location.hash = "#/servers";
      } else {
        runPlay();
      }
    }

    if (ev.target.closest("#openConsole")) {
      consoleShow("Horizon — sessão");
    }
  });

  load();

  return () => {
    busy = false;
  };
}
