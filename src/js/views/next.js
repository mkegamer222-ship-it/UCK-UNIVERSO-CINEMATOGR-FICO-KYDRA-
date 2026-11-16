/**
 * views/next.js — roadmap do Horizon (status + progresso honesto).
 */

import { store } from "../store.js";
import { esc } from "../ui.js";

const STATUS_CHIP = {
  "em andamento": "chip--accent",
  planejado: "chip",
  concluído: "chip--info",
};

export function nextView(root) {
  const items = store.roadmap();

  root.innerHTML = `
    <div class="page__inner">
      <header class="page__head">
        <h1 class="page__title">O que vem depois</h1>
        <p class="page__sub">O roadmap do Horizon, sem promessa de data. Progresso é a fração do trabalho já no main, não um cronograma.</p>
      </header>

      <div class="roadmap">
        ${items
          .map(
            (r) => `
          <article class="card road-item">
            <div>
              <div class="road-item__title">
                ${esc(r.title)}
                <span class="chip ${STATUS_CHIP[r.status] ?? "chip"}">${esc(r.status)}</span>
              </div>
            </div>
            <span class="mono xs muted">${r.progress}%</span>
            <p class="road-item__desc">${esc(r.d)}</p>
            <div class="road-item__bar">
              <div class="progress"><div class="progress__bar" style="width:${r.progress}%"></div></div>
            </div>
          </article>`
          )
          .join("")}
      </div>

      <div class="settings-foot" style="margin-top:36px;justify-content:flex-start;gap:20px">
        <a href="https://github.com/horizon-rust/horizon" target="_blank" rel="noreferrer noopener">GitHub do Horizon</a>
        <span class="dot-sep"></span>
        <a href="https://github.com/horizon-rust/horizon/issues" target="_blank" rel="noreferrer noopener">Issues</a>
        <span class="dot-sep"></span>
        <span>Licença LGPL-3.0-or-later</span>
      </div>
    </div>
  `;
}
