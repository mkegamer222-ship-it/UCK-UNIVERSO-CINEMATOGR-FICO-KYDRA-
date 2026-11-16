# Arquitetura

Três camadas, cada uma com uma responsabilidade e um jeito de testar.

```
[ view ]  src/js/views/*        renderiza HTML, escuta eventos da própria página
   │
   │  só chama store.<ação>()
   ▼
[ store ] src/js/store.js       estado + persistência + escolha do backend
   │
   ├── backend real   →  fetch /api/*          (backend/server.mjs, ou o Rust)
   └── demonstração   →  simulação em memória  (localStorage)
```

Regra única: **view nunca fala com `fetch`**. Se uma página precisa de um dado novo, ela pede ao
`store`; se o dado é dinâmico, o `store` decide entre o backend e a simulação.

---

## 1. Casca (`index.html` + `src/js/app.js`)

- SPA por **hash**: `#/play`, `#/versions`, `#/notes`, `#/next`, `#/mods`, `#/instances`,
  `#/servers`, `#/settings`. Sem roteador, sem build: `hashchange` → `render()`.
- `render()` troca o conteúdo de `<main>`, chama a view da rota e guarda a função de limpeza
  devolvida por ela (usada para matar `setInterval` ao sair da página — ver `servers.js`).
- O `subscribe()` do store redesenha a página. Exceção: `select-build`, `select-instance` e `tab`
  são mudanças locais, então só a sidebar é repintada (evita perder o scroll e o foco).
- Elementos fixos fora do `<main>`: abertura, console, toasts, modal.

## 2. Estado (`src/js/store.js`)

- `state` é um objeto único, carregado do `localStorage` (`kydra.launcher.v1`) com fusão de
  padrões — assim uma versão antiga do arquivo não quebra a nova interface.
- `set(patch, reason)` / `emit(reason)` gravam e notificam. Toda view restaura seu próprio scroll.
- `store` é a **fachada**: `versions()`, `install()`, `prepare()`, `play()`, `addInstance()`,
  `setSetting()`… As views nunca tocam `state` para escrever.

### Backend real vs. demonstração

`backend.probe()` testa `GET /api/health` uma vez, com timeout de 1,2 s, e guarda a resposta.
- **De pé** → `store` usa HTTP para versões e ações; os dados são reais.
- **Fora** → `demo.*` simula com `setTimeout`, loga no console e grava em `localStorage`.

Isso é o que permite o mesmo código rodar no preview do navegador (demo) e no app desktop (real).

## 3. Views (`src/js/views/*.js`)

Contrato: `export function xView(root, ctx)` monta o HTML em `root` e registra eventos
**dentro de `root`** (delegação), devolvendo opcionalmente uma função de limpeza.

Por que HTML em template string e não um framework: é uma interface pequena, sem listas de
milhares de itens, e o time lê o markup direto no arquivo. O custo (re-render completo a cada
mudança) foi pago de propósito e depois aliviado com a lista `QUIET` no `app.js`.

## 4. Sistema visual (`src/styles/`)

- `tokens.css` é **a** fonte de verdade de cor, tipo, espaço, raio e movimento. Nenhum outro
  arquivo inventa um hex novo.
- `views.css` só usa tokens; se precisa de um valor novo, ele nasce em `tokens.css`.
- Tema claro é um override em `:root[data-theme="light"]`, não um segundo conjunto de CSS.

## 5. Backend (`backend/server.mjs`)

Node puro, sem framework: serve a raiz do repositório com allowlist de tipos, bloqueia saída da
pasta do projeto e expõe `/api`. Importa `src/js/data/builds.js` — o **mesmo** catálogo que a
interface usa em modo demo, então não existe cópia divergente de dados.

## 6. Testes (`tests/smoke.test.mjs`)

jsdom + `node:test`. Os módulos ES são importados **de verdade** (os mesmos arquivos do
navegador); só o DOM é simulado. Cada teste ganha um DOM novo e fecha o seu. Cobrem: as 8 rotas
sem erro de script, instalação, conta, ajustes, tema, servidores (EULA, start/stop), instâncias
e busca de mods.

## Decisões e o porquê

| Decisão | Motivo |
| --- | --- |
| Sem bundler | O navegador já entende módulos ES; menos uma toolchain para a memória do repo envelhecer. |
| Sem framework | Interface pequena, markup legível, zero dependências de runtime. |
| Hash routing | Funciona abrindo o `index.html` direto e em hospedagem estática. |
| Estado em `localStorage` | O app é local por natureza; não há conta de servidor no Kydra. |
| Catálogo compartilhado | Interface e backend leem `src/js/data/builds.js`; uma verdade só. |
| Console flutuante em vez de aba | Você joga e olha o log ao mesmo tempo, sem trocar de página. |
| Ações otimistas + log | Instalar/preparar mostram progresso no herói e o passo a passo no console. |
