/**
 * components/account.js — modal de conta.
 * Microsoft é o caminho oficial; "offline" existe para jogar em LAN e testar.
 */

import { store } from "../store.js";
import { esc, openModal, toast } from "../ui.js";

export function openAccountModal() {
  const acc = store.state.account;

  if (acc) {
    openModal({
      title: "Sua conta",
      body: `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <span class="account__avatar" style="width:40px;height:40px;font-size:14px">${esc(acc.name.slice(0, 2).toUpperCase())}</span>
          <div>
            <div style="color:var(--text);font-size:15px">${esc(acc.name)}</div>
            <div class="mono xs muted">${esc(acc.uuid)}</div>
          </div>
        </div>
        <p class="xs muted">O Horizon usa esta conta para preencher perfil, skins e o servidor de autenticação. Os tokens ficam no chaveiro do sistema — o launcher nunca os grava em texto puro.</p>`,
      confirm: "Sair da conta",
      danger: true,
      onConfirm: ({ close }) => {
        store.signOut();
        close();
        toast("Você saiu da conta");
      },
    });
    return;
  }

  openModal({
    title: "Entrar",
    body: `
      <div class="field" style="margin-bottom:14px">
        <label class="field__label" for="acc-name">Nome de jogador (offline)</label>
        <input class="input" id="acc-name" maxlength="16" placeholder="Steve" autocomplete="off" />
      </div>
      <p class="xs muted">Sem conta Microsoft você joga em LAN e em mundos locais. Para servidores online, o launcher pede o login oficial — os tokens ficam no chaveiro do sistema, nunca no arquivo de configuração.</p>`,
    confirm: "Entrar offline",
    cancel: "Agora não",
    onConfirm: ({ close, root }) => {
      const name = root.querySelector("#acc-name")?.value?.trim();
      if (!name || name.length < 3) {
        toast("Escolha um nome com pelo menos 3 letras", "warn");
        return;
      }
      store.signIn(name);
      close();
      toast(`Bem-vindo, ${name}`);
    },
  });
}
