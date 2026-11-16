/**
 * views/notes.js — notas de patch (o que mudou, em texto de gente).
 */

import { store } from "../store.js";
import { esc, fmtDate, fmtRelative } from "../ui.js";

export function notesView(root) {
  const patches = store.patches();

  root.innerHTML = `
    <div class="page__inner">
      <header class="page__head">
        <h1 class="page__title">Notas de patch</h1>
        <p class="page__sub">Tudo que muda no Horizon, na ordem em que chegou. As notas vêm do corpo da release no GitHub.</p>
      </header>
      <div id="patches">
        ${patches
          .map(
            (p) => `
          <article class="patch ${p.highlight ? "patch--highlight" : ""}">
            <header class="patch__head">
              <h2 class="patch__title">${esc(p.title)}</h2>
              <span class="patch__date">${fmtDate(p.date)} · ${fmtRelative(p.date)}</span>
              <span class="chip chip--${p.tag === "nightly" ? "warn" : "accent"}">${p.tag === "nightly" ? "Nightly" : "Estável"}</span>
            </header>
            <div class="patch__items">
              ${p.items
                .map(
                  (i) => `
                <div>
                  <div class="patch__item-t">${esc(i.t)}</div>
                  <div class="patch__item-d">${esc(i.d)}</div>
                </div>`
                )
                .join("")}
            </div>
          </article>`
          )
          .join("")}
      </div>
    </div>
  `;
}
