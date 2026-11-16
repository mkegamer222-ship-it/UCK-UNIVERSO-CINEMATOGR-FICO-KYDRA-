/**
 * views/mods.js — navegador de mods / modpacks.
 * Cada mod é marcado com o que a API do Horizon consegue rodar hoje.
 */

import { icon } from "../icons.js";
import { store } from "../store.js";
import { esc, openModal, toast } from "../ui.js";
import { consoleShow, consoleWrite } from "../ui.js";

const RUNS = {
  works: { label: "Funciona", cls: "chip--accent" },
  partial: { label: "Em parte", cls: "chip--warn" },
  "not-yet": { label: "Não roda ainda", cls: "chip--danger" },
};

export function modsView(root) {
  let tab = "mods";
  let query = "";

  root.innerHTML = `
    <div class="page__inner">
      <header class="page__head">
        <h1 class="page__title">Mods</h1>
        <p class="page__sub">Do registro próprio do Horizon e do Modrinth. O download só entra na pasta do jogo depois que o SHA-512 confere.</p>
      </header>

      <div class="tabs" role="tablist">
        ${[
          ["mods", "Mods"],
          ["packs", "Modpacks"],
          ["resource", "Pacotes de recurso"],
          ["shaders", "Shaders"],
          ["datapacks", "Datapacks"],
        ]
          .map(
            ([id, label]) =>
              `<button class="tab ${id === "mods" ? "is-active" : ""}" role="tab" data-tab="${id}" type="button">${label}</button>`
          )
          .join("")}
      </div>

      <div class="toolbar">
        <div class="search">
          ${icon("search", { size: 15 })}
          <input class="input" id="modSearch" placeholder="Buscar no Modrinth e no registro do Horizon…" autocomplete="off" />
        </div>
        <div class="pills">
          <button class="pills__item is-active" data-src="all" type="button">Todas as fontes</button>
          <button class="pills__item" data-src="Modrinth" type="button">Modrinth</button>
          <button class="pills__item" data-src="CurseForge" type="button">CurseForge</button>
        </div>
      </div>

      <div id="results"></div>
    </div>
  `;

  const results = root.querySelector("#results");
  let source = "all";

  function paint() {
    if (tab === "mods") return paintMods();
    if (tab === "packs") return paintPacks();
    return paintSoon();
  }

  function paintMods() {
    const items = store
      .mods()
      .filter((m) => (source === "all" ? true : m.source === source))
      .filter((m) => (query ? m.name.toLowerCase().includes(query) : true));

    if (!items.length) {
      results.innerHTML = `<div class="empty">Nenhum mod encontrado para “${esc(query)}”.</div>`;
      return;
    }

    results.innerHTML = `<div class="mod-grid">
      ${items
        .map((m) => {
          const runs = RUNS[m.runs];
          return `
          <article class="card mod">
            <div class="mod__head">
              <div class="mod__icon">${esc(m.name[0])}</div>
              <div>
                <div class="mod__name">${esc(m.name)}</div>
                <div class="mod__src">${esc(m.source)} · ${esc(m.versions)} · ${esc(m.downloads)} downloads</div>
              </div>
            </div>
            <p class="mod__desc">${esc(m.d)}</p>
            <div class="mod__foot">
              <span class="chip ${runs.cls}">${runs.label}</span>
              <button class="btn btn--outline btn--sm" data-mod="${m.id}" type="button">Instalar</button>
            </div>
          </article>`;
        })
        .join("")}
    </div>`;
  }

  function paintPacks() {
    results.innerHTML = `
      <div class="rows">
        ${store
          .modpacks()
          .filter((p) => (query ? p.name.toLowerCase().includes(query) : true))
          .map(
            (p) => `
          <article class="row row--hover">
            <div class="row__main">
              <div class="row__title">${esc(p.name)} <span class="chip chip--plain">${esc(p.source)}</span></div>
              <div class="row__sub">${p.mods} mods · ${esc(p.size)} · cobertura <span class="mono">${p.coverage}%</span></div>
              <div class="progress" style="max-width:280px;margin-top:9px"><div class="progress__bar" style="width:${p.coverage}%"></div></div>
            </div>
            <div class="row__aside">
              <button class="btn btn--outline btn--sm" data-pack="${p.id}" type="button">Ver cobertura</button>
            </div>
          </article>`
          )
          .join("")}
      </div>`;
  }

  function paintSoon() {
    const label = { resource: "Pacotes de recurso", shaders: "Shaders", datapacks: "Datapacks" }[tab];
    results.innerHTML = `
      <div class="empty">
        <div style="margin-bottom:8px;color:var(--text-dim)">${label} entram pelo registro do Horizon.</div>
        <span class="xs">A busca nesta aba ainda não está ligada no modo demonstração.</span>
      </div>`;
  }

  root.addEventListener("input", (ev) => {
    if (ev.target.id === "modSearch") {
      query = ev.target.value.trim().toLowerCase();
      paint();
    }
  });

  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-tab]")?.dataset.tab;
    if (t) {
      tab = t;
      root.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === t));
      paint();
      return;
    }

    const s = ev.target.closest("[data-src]")?.dataset.src;
    if (s) {
      source = s;
      root.querySelectorAll("[data-src]").forEach((b) => b.classList.toggle("is-active", b.dataset.src === s));
      paint();
      return;
    }

    const mod = ev.target.closest("[data-mod]")?.dataset.mod;
    if (mod) {
      const m = store.mods().find((x) => x.id === mod);
      consoleShow(`Instalando ${m?.name}`);
      consoleWrite(`GET https://api.modrinth.com/v2/project/${mod}/version?game_versions=["26.3"]`, "dim");
      consoleWrite(`sha512 de ${m?.name}-26.3.jar confere`, "ok");
      consoleWrite(`gravado em ~/Kydra/mods/${mod}.jar`, "ok");
      toast(`${m?.name} instalado`);
    }

    const pack = ev.target.closest("[data-pack]")?.dataset.pack;
    if (pack) {
      const p = store.modpacks().find((x) => x.id === pack);
      openModal({
        title: p?.name ?? "Cobertura",
        body: `<p>${p?.coverage}% dos ${p?.mods} mods já têm equivalente rodando no Horizon. Os demais dependem da API de mods.</p>
               <div class="progress" style="margin-top:14px"><div class="progress__bar" style="width:${p?.coverage ?? 0}%"></div></div>`,
        confirm: "Portar o que dá hoje",
        onConfirm: ({ close }) => {
          close();
          toast("Port feito — jars copiados para a instância");
        },
      });
    }
  });

  paint();
}
