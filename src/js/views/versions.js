/**
 * views/versions.js — builds publicadas do horizon-rust/horizon.
 * Cada build instala na própria pasta; remover não deixa resíduo.
 */

import { icon } from "../icons.js";
import { store } from "../store.js";
import { esc, fmtBytes, fmtDate, openModal, toast, fmtRelative } from "../ui.js";
import { consoleShow, consoleWrite } from "../ui.js";

export function versionsView(root) {
  let filter = "all";
  let versions = [];

  root.innerHTML = `
    <div class="page__inner">
      <header class="page__head">
        <h1 class="page__title">Versões</h1>
        <p class="page__sub">Builds publicadas em <span class="mono">horizon-rust/horizon</span>. Cada uma instala na própria pasta; remover não deixa resíduo.</p>
      </header>

      <div class="toolbar">
        <div class="pills" role="group" aria-label="Canal">
          <button class="pills__item is-active" data-filter="all" type="button">Todas</button>
          <button class="pills__item" data-filter="stable" type="button">Estáveis</button>
          <button class="pills__item" data-filter="nightly" type="button">Nightly</button>
          <button class="pills__item" data-filter="installed" type="button">Instaladas</button>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn--outline btn--sm" data-act="import" type="button">${icon("folder", { size: 13 })} Importar build…</button>
          <button class="btn btn--ghost btn--sm" data-act="refresh" type="button">${icon("refresh", { size: 13 })} Atualizar lista</button>
        </div>
      </div>

      <div class="rows" id="list"></div>
    </div>
  `;

  const list = root.querySelector("#list");

  function paint() {
    const shown = versions.filter((v) => {
      if (filter === "all") return true;
      if (filter === "installed") return store.isInstalled(v.id);
      return v.tag === filter;
    });

    if (!shown.length) {
      list.innerHTML = `<div class="empty">${filter === "installed" ? "Nenhuma build instalada ainda." : "Nada aqui por enquanto."}</div>`;
      return;
    }

    list.innerHTML = shown
      .map((v) => {
        const inst = store.isInstalled(v.id);
        const inUse = store.state.selectedBuild === v.id;
        const meta = store.state.installed[v.id];
        return `
        <article class="row row--hover build-row">
          <div class="row__main">
            <div class="row__title">
              Horizon ${esc(v.version)}${v.parity >= 90 ? " — parity de destaque" : ""}
              ${v.tag === "nightly" ? `<span class="chip chip--warn">Nightly</span>` : `<span class="chip chip--accent">Estável</span>`}
              ${inst ? `<span class="chip chip--plain">${icon("check", { size: 11 })} instalada</span>` : ""}
              ${inUse && inst ? `<span class="chip chip--plain">em uso</span>` : ""}
            </div>
            <div class="build-row__meta">
              <span class="mono">v${esc(v.version)}</span>
              <span>·</span>
              <span>${fmtDate(v.date)}</span>
              <span>·</span>
              <span>${fmtBytes(meta?.sizeBytes ?? v.sizeBytes)}</span>
              <span>·</span>
              <span class="parity" title="Harnesses diferenciais passando">
                <span class="parity__track"><span class="parity__fill" style="width:${v.parity}%"></span></span>
                ${v.parity}% parity (${v.harnesses} harnesses)
              </span>
            </div>
            <ul class="notes-preview">${v.notes.slice(0, 2).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
          </div>
          <div class="row__aside">
            ${
              inst
                ? `<button class="btn btn--ghost btn--sm" data-use="${v.id}" type="button">${inUse ? "Em uso" : "Usar"}</button>
                   <button class="btn btn--ghost btn--sm" data-remove="${v.id}" type="button">Remover</button>`
                : `<button class="btn btn--primary btn--sm" data-install="${v.id}" type="button">${icon("download", { size: 12 })} Instalar</button>`
            }
            <button class="iconbtn" data-open="${v.id}" type="button" aria-label="Detalhes de ${esc(v.version)}">${icon("chevron", { size: 14 })}</button>
          </div>
        </article>`;
      })
      .join("");
  }

  async function install(id) {
    const v = versions.find((b) => b.id === id);
    consoleShow(`Instalando v${v?.version ?? id}`);
    consoleWrite(`kydra install ${id}`, "dim");
    const btn = root.querySelector(`[data-install="${id}"]`);
    if (btn) {
      btn.classList.add("is-busy");
      btn.innerHTML = `<span class="spinner"></span> Baixando`;
    }
    try {
      await store.install(id, (line, kind) => {
        if (typeof line === "string") consoleWrite(line, kind);
        if (line && line.progress && btn) btn.innerHTML = `<span class="spinner"></span> ${Math.round(line.progress)}%`;
      });
      toast(`Horizon ${v?.version} instalada`);
    } catch (err) {
      consoleWrite(err.message, "err");
      toast("A instalação falhou", "err");
    } finally {
      paint();
    }
  }

  function details(id) {
    const v = versions.find((b) => b.id === id);
    if (!v) return;
    openModal({
      title: `Horizon ${v.version}`,
      body: `
        <div class="build-row__meta" style="margin-bottom:12px">
          <span class="mono">v${esc(v.version)}</span><span>·</span>
          <span>${fmtDate(v.date)} (${fmtRelative(v.date)})</span><span>·</span>
          <span>${v.tag === "nightly" ? "Nightly" : "Estável"}</span>
        </div>
        <ul class="notes-preview" style="font-size:var(--fs-sm);gap:7px">
          ${v.notes.map((n) => `<li>${esc(n)}</li>`).join("")}
        </ul>
        <p class="xs muted" style="margin-top:14px">Parity ${v.parity}% · ${v.harnesses} harnesses diferenciais · ${fmtBytes(v.sizeBytes)}</p>
        <p class="xs muted" style="margin-top:8px">Assinatura: release assinada pelo Horizon. Builds importadas aparecem separadas e não recebem atualização.</p>`,
      confirm: store.isInstalled(id) ? "Fechar" : "Instalar esta build",
      cancel: "Fechar",
      onConfirm: ({ close }) => {
        close();
        if (!store.isInstalled(id)) install(id);
      },
    });
  }

  root.addEventListener("click", (ev) => {
    const f = ev.target.closest("[data-filter]")?.dataset.filter;
    if (f) {
      filter = f;
      root.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b.dataset.filter === f));
      paint();
      return;
    }

    const inst = ev.target.closest("[data-install]")?.dataset.install;
    if (inst) return install(inst);

    const use = ev.target.closest("[data-use]")?.dataset.use;
    if (use) {
      store.selectBuild(use);
      toast("Build selecionada para jogar");
      return;
    }

    const rem = ev.target.closest("[data-remove]")?.dataset.remove;
    if (rem) {
      openModal({
        title: "Remover esta build?",
        body: `<p>A pasta da build é apagada. Mundos e instâncias ficam onde estão — o launcher não toca neles.</p>`,
        confirm: "Remover",
        danger: true,
        onConfirm: async ({ close }) => {
          close();
          await store.remove(rem, (l) => consoleWrite(l, "dim"));
          toast("Build removida");
          paint();
        },
      });
      return;
    }

    const open = ev.target.closest("[data-open]")?.dataset.open;
    if (open) details(open);

    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (act === "refresh") {
      toast("Lista atualizada do GitHub");
      load();
    }
    if (act === "import") {
      openModal({
        title: "Importar build",
        body: `<p>Escolha um <span class="mono">horizon-client</span> que você compilou (ou o .zip que o contém). Ele é instalado como <span class="mono">imported-&lt;data&gt;-&lt;sha&gt;</span>, marcado como não assinado, e nenhuma atualização o substitui.</p>`,
        confirm: "Escolher arquivo…",
        onConfirm: ({ close }) => {
          close();
          toast("Seletor de arquivo (no app desktop)", "warn");
        },
      });
    }
  });

  async function load() {
    list.innerHTML = `<div class="empty"><span class="spinner" style="margin:0 auto 10px"></span>buscando releases…</div>`;
    versions = await store.versions();
    paint();
  }

  load();
}
