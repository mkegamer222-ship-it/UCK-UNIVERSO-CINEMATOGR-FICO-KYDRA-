/**
 * app.js — bootstrap: rotas, sidebar, abertura, tema e re-render.
 *
 * Rota por hash: #/play, #/versions, #/notes, #/next, #/mods, #/instances,
 * #/servers, #/settings
 */

import { icon } from "./icons.js";
import { store, subscribe } from "./store.js";
import { $, esc, on, toast, wireConsoleChrome } from "./ui.js";
import { openAccountModal } from "./components/account.js";

import { playView } from "./views/play.js";
import { versionsView } from "./views/versions.js";
import { notesView } from "./views/notes.js";
import { nextView } from "./views/next.js";
import { modsView } from "./views/mods.js";
import { instancesView } from "./views/instances.js";
import { serversView } from "./views/servers.js";
import { settingsView } from "./views/settings.js";

const ROUTES = {
  play: { label: "Jogar", icon: "play", group: null, view: playView },
  versions: { label: "Versões", icon: "layers", group: "Jogo", view: versionsView },
  mods: { label: "Mods", icon: "box", group: "Jogo", view: modsView },
  instances: { label: "Instâncias", icon: "instances", group: "Jogo", view: instancesView },
  servers: { label: "Servidores", icon: "server", group: "Jogo", view: serversView },
  notes: { label: "Notas de patch", icon: "notes", group: "Horizon", view: notesView },
  next: { label: "O que vem depois", icon: "next", group: "Horizon", view: nextView },
  settings: { label: "Ajustes", icon: "settings", group: "Horizon", view: settingsView },
};

const main = $("#main");
let cleanup = null;
let lastKey = null;

function routeName() {
  const raw = (location.hash || "#/play").replace(/^#\/?/, "").split("?")[0];
  return ROUTES[raw] ? raw : "play";
}

function buildNav() {
  const nav = $("#nav");
  let html = "";
  let lastGroup = null;
  for (const [key, r] of Object.entries(ROUTES)) {
    if (r.group && r.group !== lastGroup) {
      html += `<div class="nav__group">${r.group}</div>`;
      lastGroup = r.group;
    }
    html += `<a class="nav__item" href="#/${key}" data-route="${key}">
         ${icon(r.icon, { size: 17 })}
         <span>${r.label}</span>
       </a>`;
  }
  nav.innerHTML = html;
}

function paintNav() {
  const current = routeName();
  document.querySelectorAll(".nav__item").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.route === current);
  });
  // badge com o número de builds instaladas + updates
  const versionsLink = document.querySelector('[data-route="versions"]');
  if (versionsLink) {
    const count = store.installedBuilds().length;
    const badge = versionsLink.querySelector(".nav__badge");
    if (count > 0 && !badge) {
      versionsLink.insertAdjacentHTML("beforeend", `<span class="nav__badge">${count}</span>`);
    } else if (count === 0 && badge) {
      badge.remove();
    } else if (badge) {
      badge.textContent = String(count);
    }
  }
}

function paintAccount() {
  const btn = $("#accountBtn");
  if (!btn) return;
  const acc = store.state.account;
  if (acc) {
    btn.innerHTML = `
      <span class="account__avatar">${esc(acc.name.slice(0, 2).toUpperCase())}</span>
      <span>
        <span class="account__name">${esc(acc.name)}</span><br />
        <span class="account__sub">${acc.type === "microsoft" ? "Microsoft" : "Offline"}</span>
      </span>`;
  } else {
    btn.innerHTML = `
      <span class="account__avatar">${icon("user", { size: 14 })}</span>
      <span>
        <span class="account__name">Entrar</span><br />
        <span class="account__sub">Conta Microsoft</span>
      </span>`;
  }
}

function render() {
  const name = routeName();
  const route = ROUTES[name];
  const y = name === lastKey ? main.scrollTop : 0;

  cleanup?.();
  cleanup = null;

  document.title = `Kydra — ${route.label}`;
  main.innerHTML = "";
  const host = document.createElement("div");
  host.className = "page";
  main.appendChild(host);

  cleanup = route.view(host, { navigate: (to) => (location.hash = `#/${to}`) }) ?? null;

  paintNav();
  paintAccount();
  main.scrollTop = y;
  lastKey = name;
}

/* --- tema --------------------------------------------------------------- */
function applyAppearance() {
  const s = store.state.settings;
  document.documentElement.dataset.theme = s.appearance === "light" ? "light" : "dark";
  document.documentElement.dataset.motion = s.reduceMotion ? "reduced" : "full";
}

/* --- boot --------------------------------------------------------------- */
function boot() {
  buildNav();
  wireConsoleChrome();

  on(document, "click", "[data-account-open]", (ev) => {
    ev.preventDefault();
    openAccountModal();
  });
  on(document, "click", "[data-navigate]", (ev, el) => {
    ev.preventDefault();
    location.hash = `#/${el.dataset.navigate}`;
  });
  $("#themeBtn")?.addEventListener("click", () => {
    const next = store.state.settings.appearance === "light" ? "dark" : "light";
    store.setSetting("appearance", next);
    toast(next === "light" ? "Tema claro" : "Tema verde");
  });
  $("#accountBtn")?.addEventListener("click", () => openAccountModal());

  window.addEventListener("hashchange", render);

  // Mudanças que só afetam a seleção local: a view já se repinta sozinha, então
  // evitamos recriar a página inteira (e perder o scroll) por nada.
  const QUIET = new Set(["select-build", "select-instance", "tab"]);
  subscribe((_, reason) => {
    if (reason === "settings") applyAppearance();
    if (QUIET.has(reason)) {
      paintNav();
      paintAccount();
      return;
    }
    render();
  });

  applyAppearance();
  render();

  const opening = $("#opening");
  const finish = () => {
    opening.classList.add("is-done");
    setTimeout(() => opening.remove(), 700);
  };
  if (!store.state.settings.opening) {
    opening.remove();
  } else {
    setTimeout(finish, 1150);
  }
}

boot();
