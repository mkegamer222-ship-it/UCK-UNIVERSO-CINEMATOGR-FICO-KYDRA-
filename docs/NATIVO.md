# O executável nativo

O Kydra roda de dois jeitos, e os dois usam **o mesmo código de servidor**:

| | o que é | precisa de Node? |
| --- | --- | --- |
| `npm start` | `backend/server.mjs` (Node) serve a interface da pasta do repositório | sim |
| `dist/win/kydra.exe` | app Windows: interface **embutida** no binário, bandeja, ícone | **não** |

O `.exe` é o que o usuário final baixa. Ele não instala nada, não escreve no
registro e não lê arquivo nenhum do disco: a interface inteira vai compilada
dentro dele (HTML, CSS, JS, imagens e o catálogo de builds).

---

## Como o `.exe` é feito

```
index.html + src/** + assets/**             (fonte da interface)
        │  tools/gen-assets.mjs
        ▼
native/src/assets.h                          (arrays de bytes em C, ~1 MB)
        │
native/src/main.c            ← app Windows: bandeja, janela, sockets
native/src/server_core.c     ← rotas /api, MIME, catálogo (sem plataforma)
native/src/server_platform.c ← só send() e leitura da requisição
native/win/kydra.rc + .ico   ← ícone e VERSIONINFO
        │  zig cc -target x86_64-windows-gnu
        ▼
dist/win/kydra.exe           (~600 KB, PE32+, subsistema GUI)
```

O Linux usa **os mesmos** `server_core.c` e `server_platform.c`; só troca a
casca (`native/src/posix_main.c`). É por isso que os testes do binário rodam
aqui sem Windows: o que é testado é o mesmo núcleo que vai no `.exe`.

## Build

```bash
tools/build-exe.sh              # dist/win/kydra.exe + dist/linux/kydra-linux-x64
tools/build-exe.sh --win-only   # só o .exe
npm run build                   # idem
```

Precisa de **zig 0.13+** e **Node 20+**. Sem zig no sistema:

```bash
pip install --break-system-packages ziglang
```

O script, em ordem: embute os assets → gera a import library do UCRT (uma vez,
de `ucrtbase.def` do mingw) → compila os recursos → compila e linka o `.exe` →
marca o subsistema como GUI → compila o Linux de teste → monta `dist/`.

Nenhuma dependência de terceiros é linkada: só `kernel32`, `user32`,
`shell32`, `ws2_32`, `advapi32` e o UCRT, que já existem em qualquer Windows 10/11.

## Pasta de distribuição

```
dist/
├── LEIA-ME.txt        instruções para quem só quer usar
├── LICENCA.txt        LGPL-3.0-or-later + créditos
├── SHA256SUMS         checksums dos binários
├── win/
│   ├── kydra.exe      o app
│   ├── kydra.ico      ícone avulso (atalhos, instaladores)
│   └── PROPS.txt      formato PE, subsistema, tamanho, SHA-256
└── linux/
    └── kydra-linux-x64
```

## Comportamento do app

- `kydra.exe` → escuta em `127.0.0.1:8787` (só loopback; nada exposto na rede)
  e abre o navegador padrão.
- Ícone na **bandeja**: duplo clique abre, botão direito dá Abrir / Parar / Sair.
- Instância única por sessão (mutex nomeado): abrir de novo só traz a interface;
  `--stop` encerra a que está viva.
- `--port` muda a porta, `--no-open` não abre o navegador, `--console` anexa ao
  terminal para ver o log.
- Fechar o navegador não derruba o servidor; sair é pela bandeja ou `--stop`.

## Segurança

- Escuta **só** em loopback (`INADDR_LOOPBACK`) — outro computador não alcança.
- Serve **apenas** o que está embutido: a busca é numa tabela em C, então
  `/../etc/passwd`, `%2e%2e%2f` e caminhos parecidos caem em 404 (o
  `normalize()` resolve `.`/`..` antes de qualquer comparação).
- Sem execução de arquivo a partir do caminho pedido, sem listagem de diretório.
- Sem assinatura de código: o hash está em `SHA256SUMS` e o fonte está no repo.

## Testes

```bash
npm test     # inclui tests/native.test.mjs
```

`tests/native.test.mjs` copia o binário para uma **pasta vazia**, roda e exige
que HTML, app.js, CSS, catálogo e imagem saiam de dentro dele — é o que prova
que o `.exe` é autossuficiente. Também cobre 404, 405, rota inexistente e
tentativa de path traversal (inclusive crua, por socket).
