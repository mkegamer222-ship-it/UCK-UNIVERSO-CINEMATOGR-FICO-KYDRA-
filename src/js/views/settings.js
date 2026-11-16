/**
 * views/settings.js — contas, atualizações, menus, argumentos, memória,
 * aparência, coleta de dados e a localização dos dados.
 *
 * Padrão Horizon: linhas numeradas (01, 02, …) com controle à direita.
 */

import { icon } from "../icons.js";
import { store } from "../store.js";
import { esc, openModal, toast } from "../ui.js";
import { openAccountModal } from "../components/account.js";

export function settingsView(root) {
  let n = 0;

  const row = ({ title, desc, control, html }) => {
    n += 1;
    return `
      <div class="setting">
        <span class="setting__num">${String(n).padStart(2, "0")}</span>
        <div class="setting__main">
          <div class="setting__title">${title}</div>
          ${desc ? `<div class="setting__desc">${desc}</div>` : ""}
          ${html ?? ""}
        </div>
        <div class="setting__control">${control ?? ""}</div>
      </div>`;
  };

  const toggle = (key, on, label = key) => `
    <button class="toggle" role="switch" aria-checked="${on}" data-toggle="${key}" type="button" aria-label="${esc(label)}"></button>`;

  const paint = () => {
    n = 0;
    const s = store.state.settings;
    const acc = store.state.account;

    root.innerHTML = `
      <div class="page__inner">
        <header class="page__head">
          <h1 class="page__title">Ajustes</h1>
          <p class="page__sub">Conta, atualizações, menus do jogo e o launcher em si.</p>
        </header>

        <section class="settings-block">
          <div class="settings-block__title">Conta e jogo</div>
          ${row({
            title: "Conta",
            desc: acc
              ? `Jogando como <strong style="color:var(--text)">${esc(acc.name)}</strong> (${acc.type === "microsoft" ? "Microsoft" : "offline"}). Tokens no chaveiro do sistema.`
              : "Entre com a Microsoft para servidores online, ou com um nome para jogar em LAN.",
            control: `<button class="btn btn--outline btn--sm" data-act="account" type="button">${acc ? "Gerenciar" : "Entrar"}</button>`,
          })}
          ${row({
            title: "Instalar novas versões automaticamente",
            desc: "A versão escolhida só muda se você estava jogando a mais nova.",
            control: toggle("autoInstall", s.autoInstall, "Instalar novas versões automaticamente"),
          })}
          ${row({
            title: "Canal de atualização",
            desc: "Estável: build testada uma vez ao dia. Nightly: toda mudança assim que compila — pode quebrar.",
            control: `<div class="pills"><button class="pills__item ${s.channel === "stable" ? "is-active" : ""}" data-channel="stable" type="button">Estável</button><button class="pills__item ${s.channel === "nightly" ? "is-active" : ""}" data-channel="nightly" type="button">Nightly</button></div>`,
          })}
          ${row({
            title: "Memória para o jogo",
            desc: "Reservado para o processo do Horizon. 4 GB cobre vanilla com shaders leves.",
            control: `<select class="input" data-memory>
              ${[2048, 4096, 6144, 8192, 12288, 16384]
                .map((m) => `<option value="${m}" ${s.memory === m ? "selected" : ""}>${m / 1024} GB</option>`)
                .join("")}
            </select>`,
          })}
          ${row({
            title: "Java",
            desc: "Horizon exige Java 25. Em “automático” usamos o runtime que o próprio launcher gerencia.",
            control: `<select class="input" data-java>
              <option value="auto" ${s.java === "auto" ? "selected" : ""}>Automático (gerenciado)</option>
              <option value="temurin" ${s.java === "temurin" ? "selected" : ""}>Temurin 25.0.1</option>
              <option value="system" ${s.java === "system" ? "selected" : ""}>Java do sistema</option>
            </select>`,
          })}
        </section>

        <section class="settings-block">
          <div class="settings-block__title">Launcher</div>
          ${row({
            title: "Mostrar a abertura",
            desc: "O wordmark enquanto a lista de releases carrega.",
            control: toggle("opening", s.opening, "Mostrar a abertura"),
          })}
          ${row({
            title: "Menus do jogo",
            desc: "Clássico é a tela do vanilla, sem caminho de volta para o launcher dentro do jogo. Aplica na próxima vez que o jogo abrir.",
            control: `<div class="pills"><button class="pills__item ${s.gameMenus === "kydra" ? "is-active" : ""}" data-menus="kydra" type="button">Kydra</button><button class="pills__item ${s.gameMenus === "classic" ? "is-active" : ""}" data-menus="classic" type="button">Clássico</button></div>`,
          })}
          ${row({
            title: "Argumentos do jogo",
            desc: "Repassados como estão (aspas agrupam uma palavra com espaços). Aplica na próxima vez que o jogo abrir.",
            control: `<input class="input" data-args value="${esc(s.gameArgs)}" placeholder="Por exemplo --server-thread" />`,
          })}
          ${row({
            title: "Aparência",
            desc: "O tema verde é o padrão do Kydra; o claro existe para jogar de dia.",
            control: `<div class="pills"><button class="pills__item ${s.appearance === "dark" ? "is-active" : ""}" data-appearance="dark" type="button">Verde escuro</button><button class="pills__item ${s.appearance === "light" ? "is-active" : ""}" data-appearance="light" type="button">Claro</button></div>`,
          })}
          ${row({
            title: "Reduzir movimento",
            desc: "Desliga animações de abertura, transições de página e o pulso do console.",
            control: toggle("reduceMotion", s.reduceMotion, "Reduzir movimento"),
          })}
        </section>

        <section class="settings-block">
          <div class="settings-block__title">Dados</div>
          ${row({
            title: "Pasta das instâncias",
            desc: "Onde ficam mundos, opções e packs de cada instância.",
            control: `<div style="display:flex;gap:6px"><input class="input mono" data-dir="instanceDir" value="${esc(s.instanceDir)}" /><button class="btn btn--ghost btn--sm" data-act="move" type="button">Mover…</button></div>`,
          })}
          ${row({
            title: "Pasta de dados do launcher",
            desc: "Instalações, downloads e arquivos de conta. O ponteiro de local fica fora dela.",
            control: `<input class="input mono" data-dir="dataDir" value="${esc(s.dataDir)}" />`,
          })}
          ${row({
            title: "Coleta de dados",
            desc: "Tudo desligado até você ligar. Cada interruptor é independente.",
            html: `
              <div style="display:grid;gap:8px;margin-top:10px">
                ${[
                  ["perf", "Estatísticas de desempenho"],
                  ["crashes", "Relatórios de crash"],
                  ["bugs", "Relatórios de bug"],
                  ["benchmarks", "Uploads de benchmark"],
                ]
                  .map(
                    ([k, label]) => `
                  <label style="display:flex;align-items:center;gap:10px;font-size:var(--fs-sm);color:var(--text-dim)">
                    <button class="toggle" role="switch" aria-checked="${s.telemetry[k]}" data-telemetry="${k}" type="button" aria-label="${label}"></button>
                    ${label}
                  </label>`
                  )
                  .join("")}
              </div>
              <pre class="telemetry-json">${esc(
                JSON.stringify(
                  {
                    schema: 3,
                    launcher: "kydra/0.1.0",
                    consent: s.telemetry,
                    would_send: s.telemetry.perf
                      ? { event: "session", frame_ms_p95: 7.4, start_to_first_frame_ms: 812 }
                      : null,
                  },
                  null,
                  2
                )
              )}</pre>`,
            control: `<button class="btn btn--ghost btn--sm" data-act="clear-telemetry" type="button">Apagar</button>`,
          })}
        </section>

        <section class="settings-block">
          <div class="settings-block__title">Sobre</div>
          ${row({
            title: "Kydra Launcher 0.1.0",
            desc: "Interface para instalar, preparar e iniciar builds do Horizon. O jogo é do projeto <span class='mono'>horizon-rust/horizon</span>, sob LGPL-3.0-or-later.",
            control: `<button class="btn btn--ghost btn--sm" data-act="logs" type="button">${icon("folder", { size: 12 })} Logs</button>`,
          })}
        </section>

        <div class="settings-foot">
          <span>Kydra Launcher 0.1.0</span>
          <span class="dot-sep"></span>
          <a href="https://github.com/horizon-rust/horizon" target="_blank" rel="noreferrer noopener">HORIZON NO GITHUB</a>
          <span class="dot-sep"></span>
          <a href="https://github.com/horizon-rust/horizon/issues" target="_blank" rel="noreferrer noopener">ISSUES</a>
          <span style="margin-left:auto" class="mono">${store.state.installed ? Object.keys(store.state.installed).length : 0} builds instaladas</span>
        </div>
      </div>
    `;
  };

  paint();

  root.addEventListener("click", (ev) => {
    const t = ev.target;

    const tg = t.closest("[data-toggle]");
    if (tg) {
      const key = tg.dataset.toggle;
      const next = tg.getAttribute("aria-checked") !== "true";
      store.setSetting(key, next);
      toast(next ? "Ligado" : "Desligado");
      return;
    }

    const tm = t.closest("[data-telemetry]");
    if (tm) {
      const key = tm.dataset.telemetry;
      const next = tm.getAttribute("aria-checked") !== "true";
      store.setTelemetry(key, next);
      return;
    }

    const ch = t.closest("[data-channel]")?.dataset.channel;
    if (ch) {
      store.setSetting("channel", ch);
      return;
    }

    const menus = t.closest("[data-menus]")?.dataset.menus;
    if (menus) {
      store.setSetting("gameMenus", menus);
      return;
    }

    const app = t.closest("[data-appearance]")?.dataset.appearance;
    if (app) {
      store.setSetting("appearance", app);
      return;
    }

    const act = t.closest("[data-act]")?.dataset.act;
    if (act === "account") return openAccountModal();
    if (act === "move") {
      openModal({
        title: "Mover os dados",
        body: `<p>Copia instalações, downloads, arquivos de conta, mundos e instâncias para uma pasta vazia, verifica a cópia e só então troca o local. As pastas antigas ficam como cópia de recuperação e continuam ocupando disco.</p><p class="xs muted" style="margin-top:8px">Feche o jogo e os servidores antes. Links e sobreposições de pasta são recusados.</p>`,
        confirm: "Escolher pasta…",
        onConfirm: ({ close }) => {
          close();
          toast("Seletor de pasta (no app desktop)", "warn");
        },
      });
      return;
    }
    if (act === "clear-telemetry") {
      toast("Nada enviado deste computador — já está limpo");
      return;
    }
    if (act === "logs") {
      toast("Abrindo a pasta de logs");
    }
  });

  root.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.matches("[data-memory]")) store.setSetting("memory", Number(el.value));
    if (el.matches("[data-java]")) store.setSetting("java", el.value);
    if (el.matches("[data-args]")) store.setSetting("gameArgs", el.value);
    const dir = el.dataset.dir;
    if (dir) store.setSetting(dir, el.value);
  });
}
