/**
 * views/instances.js — pastas de jogo separadas, cada uma com seus mundos,
 * opções e packs. A primeira ("Kydra") é a pasta principal do jogo.
 */

import { icon } from "../icons.js";
import { store } from "../store.js";
import { esc, openModal, toast } from "../ui.js";

const COLORS = ["#3ee07f", "#6ff0c4", "#a8e05f", "#5fc8f0", "#c9a6ff", "#f5b96b"];

export function instancesView(root) {
  root.innerHTML = `
    <div class="page__inner">
      <header class="page__head">
        <h1 class="page__title">Instâncias</h1>
        <p class="page__sub">Pastas de jogo separadas: cada uma com seus mundos, opções e packs. Renomear não move nada do disco.</p>
      </header>
      <div class="toolbar">
        <button class="btn btn--primary btn--sm" id="newInst" type="button">${icon("instances", { size: 13 })} Nova instância</button>
        <button class="btn btn--outline btn--sm" data-act="folder" type="button">${icon("folder", { size: 13 })} Abrir pasta</button>
        <span class="xs muted" style="margin-left:auto">${esc(store.state.settings.instanceDir)}</span>
      </div>
      <div class="inst-grid" id="grid"></div>
    </div>
  `;

  const grid = root.querySelector("#grid");

  function hours(ms) {
    const h = Math.floor((ms || 0) / 3_600_000);
    return h > 0 ? `${h} h` : "0 h";
  }

  function paint() {
    grid.innerHTML = store.state.instances
      .map((i) => {
        const active = i.id === store.state.selectedInstance;
        return `
        <article class="card inst ${active ? "is-active" : ""}">
          <div class="inst__top">
            <div class="instance-badge" style="--badge:${i.color}">${esc(i.name[0].toUpperCase())}</div>
            <div style="min-width:0">
              <div class="inst__name truncate">${esc(i.name)}</div>
              <div class="xs muted">${esc(i.group)}${active ? " · em uso" : ""}</div>
            </div>
          </div>
          <div class="inst__meta">
            <span>${hours(i.playtimeMs)} jogadas</span>
            <span>${i.lastPlayed ? new Date(i.lastPlayed).toLocaleDateString("pt-BR") : "nunca"}</span>
          </div>
          <div class="inst__actions">
            <button class="btn ${active ? "btn--outline" : "btn--primary"} btn--sm" data-select="${i.id}" type="button">${active ? "Selecionada" : "Jogar esta"}</button>
            <button class="btn btn--ghost btn--sm" data-edit="${i.id}" type="button">Editar</button>
            ${
              i.id === "default"
                ? ""
                : `<button class="iconbtn" data-del="${i.id}" type="button" aria-label="Excluir ${esc(i.name)}">${icon("trash", { size: 14 })}</button>`
            }
          </div>
        </article>`;
      })
      .join("");
  }

  function form(inst) {
    return `
      <div class="field" style="margin-bottom:12px">
        <label class="field__label" for="i-name">Nome</label>
        <input class="input" id="i-name" maxlength="24" value="${esc(inst?.name ?? "")}" placeholder="Meu mundo" />
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="field__label" for="i-group">Grupo</label>
        <input class="input" id="i-group" maxlength="24" value="${esc(inst?.group ?? "Principal")}" placeholder="Principal" />
      </div>
      <div class="field">
        <span class="field__label">Cor</span>
        <div style="display:flex;gap:8px" id="i-colors">
          ${COLORS.map(
            (c) =>
              `<button type="button" data-color="${c}" style="width:26px;height:26px;border-radius:7px;background:${c};box-shadow:inset 0 0 0 1px rgba(0,0,0,.3)${inst?.color === c ? ", 0 0 0 2px var(--text)" : ""}"></button>`
          ).join("")}
        </div>
      </div>`;
  }

  function openForm(inst) {
    let color = inst?.color ?? COLORS[store.state.instances.length % COLORS.length];
    const modal = openModal({
      title: inst ? "Editar instância" : "Nova instância",
      body: form(inst),
      confirm: inst ? "Salvar" : "Criar",
      onConfirm: ({ close, root: mroot }) => {
        const name = mroot.querySelector("#i-name").value.trim();
        const group = mroot.querySelector("#i-group").value.trim() || "Principal";
        if (!name) {
          toast("Dê um nome à instância", "warn");
          return;
        }
        if (inst) {
          store.updateInstance(inst.id, { name, group, color });
          toast("Instância atualizada");
        } else {
          store.addInstance({ name, group, color });
          toast(`Instância “${name}” criada`);
        }
        close();
      },
    });
    const mroot = document.querySelector("#modalRoot");
    mroot.querySelector("#i-colors").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-color]");
      if (!b) return;
      color = b.dataset.color;
      mroot.querySelectorAll("[data-color]").forEach((x) => (x.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,.3)"));
      b.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,.3), 0 0 0 2px var(--text)";
    });
    return modal;
  }

  root.addEventListener("click", (ev) => {
    if (ev.target.closest("#newInst")) return openForm(null);

    const sel = ev.target.closest("[data-select]")?.dataset.select;
    if (sel) {
      store.selectInstance(sel);
      toast("Instância selecionada");
      return;
    }

    const ed = ev.target.closest("[data-edit]")?.dataset.edit;
    if (ed) return openForm(store.state.instances.find((i) => i.id === ed));

    const del = ev.target.closest("[data-del]")?.dataset.del;
    if (del) {
      openModal({
        title: "Excluir instância?",
        body: `<p>A entrada sai da lista. A pasta no disco fica — apague você mesmo se quiser o espaço de volta.</p>`,
        confirm: "Excluir",
        danger: true,
        onConfirm: ({ close }) => {
          store.removeInstance(del);
          close();
          toast("Instância removida da lista");
        },
      });
      return;
    }

    if (ev.target.closest('[data-act="folder"]')) toast("Abrindo " + store.state.settings.instanceDir);
  });

  paint();
}
