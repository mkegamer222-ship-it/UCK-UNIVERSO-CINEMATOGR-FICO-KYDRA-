/**
 * ui.js — helpers de DOM, escape, toasts, modal e o console de execução.
 * Nada aqui conhece as views: é a camada de "chrome" do launcher.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto que vai para dentro de HTML. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Delegação de eventos: on(main, "click", "[data-go]", fn) */
export function on(root, type, selector, handler, opts) {
  root.addEventListener(
    type,
    (ev) => {
      const target = ev.target.closest(selector);
      if (target && root.contains(target)) handler(ev, target);
    },
    opts
  );
}

/* --- Toasts ------------------------------------------------------------- */
const toastHost = () => $("#toasts");

export function toast(message, kind = "ok", ms = 2600) {
  const host = toastHost();
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span class="toast__dot"></span><span>${esc(message)}</span>`;
  host.appendChild(el);
  const kill = () => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 220);
  };
  setTimeout(kill, ms);
  el.addEventListener("click", kill);
}

/* --- Modal -------------------------------------------------------------- */
export function openModal({ title, body = "", confirm = "Confirmar", cancel = "Cancelar", danger = false, onConfirm }) {
  const root = $("#modalRoot");
  root.hidden = false;
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2 class="modal__title">${esc(title)}</h2>
      <div class="modal__body">${body}</div>
      <div class="modal__foot">
        <button class="btn btn--ghost" data-modal-cancel type="button">${esc(cancel)}</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-modal-ok type="button">${esc(confirm)}</button>
      </div>
    </div>`;

  const close = () => {
    root.hidden = true;
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev) => {
    if (ev.key === "Escape") close();
  };
  const okBtn = $("[data-modal-ok]", root);

  $("[data-modal-cancel]", root).addEventListener("click", close);
  okBtn.addEventListener("click", () => {
    if (onConfirm) onConfirm({ close, root });
    else close();
  });
  root.addEventListener("click", (ev) => {
    if (ev.target === root) close();
  });
  document.addEventListener("keydown", onKey);
  okBtn.focus();
  return { close };
}

/* --- Console ------------------------------------------------------------ */
const CONSOLE_MAX = 400;
let consoleLines = [];
let consoleOpen = false;

export function consoleWrite(text, kind = "") {
  const stamp = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  consoleLines.push({ text, kind, stamp });
  if (consoleLines.length > CONSOLE_MAX) consoleLines = consoleLines.slice(-CONSOLE_MAX);
  renderConsole();
}

export function consoleClear() {
  consoleLines = [];
  renderConsole();
}

function renderConsole() {
  const body = $("#consoleBody");
  if (!body) return;
  body.innerHTML = consoleLines
    .map(
      (l) =>
        `<div><span class="dim">${l.stamp}</span> <span class="${l.kind}">${esc(l.text)}</span></div>`
    )
    .join("");
  body.scrollTop = body.scrollHeight;
}

export function consoleShow(title = "Console") {
  const el = $("#console");
  if (!el) return;
  el.hidden = false;
  $("#consoleTitle").textContent = title;
  consoleOpen = true;
  renderConsole();
}

export function consoleHide() {
  const el = $("#console");
  if (!el) return;
  el.hidden = true;
  consoleOpen = false;
}

export const isConsoleOpen = () => consoleOpen;

export function consoleText() {
  return consoleLines.map((l) => `${l.stamp} ${l.text}`).join("\n");
}

export function wireConsoleChrome() {
  $("#consoleClose")?.addEventListener("click", consoleHide);
  $("#consoleCopy")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(consoleText());
      toast("Console copiado");
    } catch {
      toast("Não foi possível copiar", "warn");
    }
  });
}

/* --- Formatadores ------------------------------------------------------- */
export const fmtBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export const fmtDate = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtRelative = (iso) => {
  const then = new Date(`${iso}T12:00:00`).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  return months <= 1 ? "há 1 mês" : `há ${months} meses`;
};

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
