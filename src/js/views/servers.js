/**
 * views/servers.js — hospedar um mundo para os amigos, com botões.
 * O launcher é só a interface: quem manda é o `horizon-server`.
 */

import { icon } from "../icons.js";
import { esc, openModal, toast, delay } from "../ui.js";
import { consoleShow, consoleWrite } from "../ui.js";

const LS_KEY = "kydra.servers.v1";

const SEED_SERVERS = [
  {
    id: "friday-night",
    name: "Friday Night",
    running: true,
    players: 0,
    maxPlayers: 10,
    tps: 20,
    mspt: 0.6,
    ramMb: 584,
    port: 25565,
    address: "192.168.1.20",
    uptime: "up 32 s",
  },
];

function loadServers() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignora */
  }
  return structuredClone(SEED_SERVERS);
}

function saveServers(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignora */
  }
}

export function serversView(root) {
  let servers = loadServers();

  root.innerHTML = `
    <div class="page__inner">
      <header class="page__head">
        <h1 class="page__title">Servidores</h1>
        <p class="page__sub">Um mundo para os amigos, com botões. Iniciar, parar, reiniciar, backup — tudo passa pelo <span class="mono">horizon-server</span>.</p>
      </header>

      <section id="running"></section>

      <section style="margin-top:36px">
        <div class="settings-block__title">Criar um servidor</div>
        <div class="srv-templates">
          ${[
            ["vanilla", "box", "Survival vanilla", "Mundo novo, dificuldade normal, só amigos."],
            ["creative", "instances", "Criativo para construir", "Voo liberado, pacífica, até 10 jogadores."],
            ["copy", "folder", "Copiar um mundo meu", "Usa um dos seus mundos single-player."],
          ]
            .map(
              ([id, ic, name, d]) => `
            <button class="card srv-template" data-new="${id}" type="button">
              ${icon(ic, { size: 18 })}
              <span class="srv-template__name">${name}</span>
              <span class="srv-template__d">${d}</span>
            </button>`
            )
            .join("")}
        </div>
      </section>
    </div>
  `;

  const host = root.querySelector("#running");

  function paint() {
    if (!servers.length) {
      host.innerHTML = `<div class="empty">Nenhum servidor ainda. Crie um abaixo — com os padrões você já sai com um survival só para amigos.</div>`;
      return;
    }

    host.innerHTML = `<div class="srv-list">
      ${servers
        .map(
          (s) => `
        <article class="card srv" data-server="${esc(s.id)}">
          <div class="srv__head">
            <span class="status ${s.running ? "status--ok" : ""}">
              <span class="status__dot"></span>${s.running ? "Rodando" : "Parado"}${s.running ? ` · ${esc(s.uptime)}` : ""}
            </span>
            <h2 class="srv__name">${esc(s.name)}</h2>
            <div style="margin-left:auto;display:flex;gap:6px">
              ${
                s.running
                  ? `<button class="btn btn--outline btn--sm" data-stop="${esc(s.id)}" type="button">Parar</button>
                     <button class="btn btn--ghost btn--sm" data-restart="${esc(s.id)}" type="button">Reiniciar</button>`
                  : `<button class="btn btn--primary btn--sm" data-start="${esc(s.id)}" type="button">${icon("play", { size: 12 })} Iniciar</button>`
              }
              <button class="iconbtn" data-del="${esc(s.id)}" type="button" aria-label="Remover servidor">${icon("trash", { size: 14 })}</button>
            </div>
          </div>

          <div class="srv__stats">
            <div class="stat"><div class="stat__value">${s.players} / ${s.maxPlayers}</div><div class="stat__label">Jogadores online</div></div>
            <div class="stat"><div class="stat__value">${s.running ? s.tps.toFixed(1) : "—"}</div><div class="stat__label">TPS · 20 é cheio</div></div>
            <div class="stat"><div class="stat__value">${s.running ? `${s.mspt.toFixed(1)} ms` : "—"}</div><div class="stat__label">MSPT · tempo de tick</div></div>
            <div class="stat"><div class="stat__value">${s.running ? `${(s.ramMb / 1024).toFixed(2)} GB` : "—"}</div><div class="stat__label">RAM</div></div>
          </div>

          <div class="srv__addr">
            <span>endereço na rede</span>
            ${esc(s.address)}:${s.port}
            <button class="btn btn--ghost btn--sm" data-copy="${esc(s.address)}:${s.port}" type="button" style="margin-left:auto">${icon("copy", { size: 12 })} Copiar</button>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn--ghost btn--sm" data-console="${esc(s.id)}" type="button">${icon("terminal", { size: 12 })} Console</button>
            <button class="btn btn--ghost btn--sm" data-backup="${esc(s.id)}" type="button">Backup agora</button>
            <button class="btn btn--ghost btn--sm" data-web="${esc(s.id)}" type="button">${icon("globe", { size: 12 })} Painel web</button>
            <button class="btn btn--ghost btn--sm" disabled title="Chega com o Tailscale ligado" type="button">${icon("users", { size: 12 })} Amigos pela internet</button>
          </div>
        </article>`
        )
        .join("")}
    </div>`;
    saveServers(servers);
  }

  function byId(id) {
    return servers.find((s) => s.id === id);
  }

  root.addEventListener("click", async (ev) => {
    const t = ev.target;

    const copy = t.closest("[data-copy]")?.dataset.copy;
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy);
        toast("Endereço copiado");
      } catch {
        toast("Não deu para copiar", "warn");
      }
      return;
    }

    const start = t.closest("[data-start]")?.dataset.start;
    if (start) {
      const s = byId(start);
      s.running = true;
      s.uptime = "up 0 s";
      s.tps = 20;
      s.mspt = 0.5;
      s.ramMb = 420;
      paint();
      consoleShow(`Servidor — ${s.name}`);
      consoleWrite("horizon-server start", "dim");
      consoleWrite("carregando mundo: " + s.name, "");
      await delay(700);
      consoleWrite("servidor pronto na porta " + s.port, "ok");
      toast("Servidor no ar");
      return;
    }

    const stop = t.closest("[data-stop]")?.dataset.stop;
    if (stop) {
      const s = byId(stop);
      s.running = false;
      s.tps = 0;
      s.mspt = 0;
      s.ramMb = 0;
      s.players = 0;
      paint();
      consoleWrite("mundo salvo, servidor parado", "warn");
      toast("Servidor parado");
      return;
    }

    const restart = t.closest("[data-restart]")?.dataset.restart;
    if (restart) {
      const s = byId(restart);
      s.uptime = "up 0 s";
      paint();
      toast("Servidor reiniciado");
      return;
    }

    const backup = t.closest("[data-backup]")?.dataset.backup;
    if (backup) {
      const s = byId(backup);
      consoleShow(`Backup — ${s.name}`);
      consoleWrite("horizon-server backup", "dim");
      await delay(600);
      consoleWrite("backups/" + new Date().toISOString().slice(0, 10) + "-" + s.name.toLowerCase().replace(/\s+/g, "-") + ".tar.zst", "ok");
      toast("Backup feito");
      return;
    }

    const cons = t.closest("[data-console]")?.dataset.console;
    if (cons) {
      consoleShow(`Console — ${byId(cons).name}`);
      return;
    }

    const web = t.closest("[data-web]")?.dataset.web;
    if (web) {
      toast("No app desktop abre o painel web do horizon-server", "warn");
      return;
    }

    const del = t.closest("[data-del]")?.dataset.del;
    if (del) {
      openModal({
        title: "Remover servidor?",
        body: `<p>A entrada sai da lista do launcher. A pasta do servidor e os backups ficam no disco.</p>`,
        confirm: "Remover",
        danger: true,
        onConfirm: ({ close }) => {
          servers = servers.filter((s) => s.id !== del);
          close();
          paint();
          toast("Servidor removido da lista");
        },
      });
      return;
    }

    const nov = t.closest("[data-new]")?.dataset.new;
    if (nov) openCreate(nov);
  });

  function openCreate(kind) {
    openModal({
      title: "Criar um servidor",
      body: `
        <div class="field" style="margin-bottom:12px">
          <label class="field__label" for="s-name">Nome</label>
          <input class="input" id="s-name" maxlength="28" placeholder="Mundo dos amigos" />
        </div>
        <div class="field" style="margin-bottom:12px">
          <label class="field__label" for="s-mode">Modo de jogo</label>
          <select class="input" id="s-mode">
            <option value="survival" ${kind === "vanilla" ? "selected" : ""}>Survival</option>
            <option value="creative" ${kind === "creative" ? "selected" : ""}>Criativo</option>
            <option value="adventure">Aventura</option>
          </select>
        </div>
        <div class="field" style="margin-bottom:12px">
          <label class="field__label" for="s-max">Máximo de jogadores</label>
          <input class="input" id="s-max" type="number" min="2" max="40" value="10" />
        </div>
        <label class="xs muted" style="display:flex;gap:8px;align-items:flex-start;margin-top:6px">
          <input type="checkbox" id="s-eula" style="margin-top:3px" />
          <span>Aceito o EULA da Minecraft e o servidor só abre para quem eu convidar.</span>
        </label>`,
      confirm: "Criar servidor",
      onConfirm: ({ close, root: m }) => {
        if (!m.querySelector("#s-eula").checked) {
          toast("Aceite o EULA para continuar", "warn");
          return;
        }
        const name = m.querySelector("#s-name").value.trim() || "Mundo dos amigos";
        const mode = m.querySelector("#s-mode").value;
        const maxPlayers = Number(m.querySelector("#s-max").value) || 10;
        servers.push({
          id: `srv-${Date.now().toString(36)}`,
          name,
          running: false,
          players: 0,
          maxPlayers,
          mode,
          tps: 0,
          mspt: 0,
          ramMb: 0,
          port: 25565 + servers.length,
          address: "192.168.1.20",
          uptime: "",
        });
        close();
        paint();
        toast(`Servidor “${name}” criado`);
      },
    });
  }

  paint();

  const timer = setInterval(() => {
    let dirty = false;
    servers.forEach((s) => {
      if (!s.running) return;
      s.tps = Math.min(20, Math.max(18.4, s.tps + (Math.random() - 0.5) * 0.9));
      s.mspt = Math.max(0.3, Math.min(4.2, 50 / s.tps));
      s.ramMb = Math.round(s.ramMb + (Math.random() - 0.45) * 26);
      dirty = true;
    });
    if (dirty) paint();
  }, 3000);

  return () => clearInterval(timer);
}
