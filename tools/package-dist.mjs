#!/usr/bin/env node
/**
 * tools/package-dist.mjs — monta a pasta de distribuição organizada.
 *
 * Resultado:
 *
 *   dist/
 *   ├── LEIA-ME.txt                  ← instruções para quem só quer usar
 *   ├── LICENCA.txt                  ← LGPL-3.0-or-later + créditos
 *   ├── SHA256SUMS                   ← checksums de tudo que é binário
 *   ├── win/
 *   │   ├── kydra.exe                ← o app (interface embutida, ícone, versão)
 *   │   ├── kydra.ico
 *   │   └── PROPS.txt                ← PE, subsistema, tamanho, hash
 *   └── linux/
 *       └── kydra-linux-x64
 *
 *   node tools/package-dist.mjs
 */

import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));

const exists = (p) => fs.stat(p).then(() => true, () => false);
const sha256 = async (p) => crypto.createHash("sha256").update(await fs.readFile(p)).digest("hex");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/** Lê os campos que importam de um PE do Windows. */
async function peInfo(file) {
  const buf = await fs.readFile(file);
  if (buf.toString("ascii", 0, 2) !== "MZ") return { ok: false };
  const pe = buf.readUInt32LE(0x3c);
  if (buf.toString("ascii", pe, pe + 4) !== "PE\0\0") return { ok: false };
  const opt = pe + 24;
  const magic = buf.readUInt16LE(opt);
  return {
    ok: true,
    format: magic === 0x20b ? "PE32+ (x86-64)" : magic === 0x10b ? "PE32 (x86)" : `0x${magic.toString(16)}`,
    machine: buf.readUInt16LE(pe + 4) === 0x8664 ? "x86-64" : "0x" + buf.readUInt16LE(pe + 4).toString(16),
    subsystem: buf.readUInt16LE(opt + 68) === 2 ? "GUI (2) — sem console" : `${buf.readUInt16LE(opt + 68)}`,
    bytes: buf.length,
  };
}

// PDB é símbolo de depuração: não vai para a pasta de entrega.
for (const junk of ["win/kydra.pdb"]) {
  await fs.rm(path.join(DIST, junk), { force: true });
}

const lines = [];
const sums = [];

const readme = `KYDRA LAUNCHER ${pkg.version}
=================================

Interface verde para instalar, preparar e abrir o HORIZON — Minecraft: Java
Edition 26.3 reescrito em Rust (github.com/horizon-rust/horizon).

COMO USAR (Windows)
-------------------
1. Coloque a pasta "win" em qualquer lugar (ex.: C:\\Program Files\\Kydra).
2. Dê dois cliques em "kydra.exe".
3. A interface abre em http://127.0.0.1:8787 no seu navegador.
4. O ícone fica na BANDEJA do sistema (perto do relógio): clique com o botão
   direito para Abrir, Parar ou Sair.

Nada para instalar. Nada para baixar. O executável tem a interface inteira
dentro dele (HTML, CSS, JS, imagens): pode mover, renomear ou copiar o .exe
que ele continua funcionando do mesmo jeito.

OPÇÕES DE LINHA DE COMANDO (atalho com propriedades → destino)
-------------------------------------------------------------
   kydra.exe                 porta padrão (8787) e abre o navegador
   kydra.exe --port 9000     outra porta
   kydra.exe --no-open       não abre o navegador
   kydra.exe --stop          encerra a instância que já está rodando
   kydra.exe --console       anexa ao console do terminal (para ver o log)
   kydra.exe --version       mostra a versão
   kydra.exe --help          este resumo

O QUE ELE FAZ
-------------
- Lista as builds publicadas do Horizon com o parity de cada uma.
- Instala numa pasta própria, remove sem deixar resíduo.
- Prepara os arquivos do jogo a partir da SUA instalação do Minecraft.
- Abre o cliente; na página Servidores, hospeda um mundo para os amigos.
- Não redistribui nada da Mojang e não baixa de espelhos.

SE ALGO DER ERRADO
------------------
- "A porta está em uso": já existe um Kydra aberto (ou outro programa na
  porta). Use o ícone da bandeja ou rode com --port 9000.
- Nada abre: o navegador padrão pode estar bloqueando. Abra você mesmo
  http://127.0.0.1:8787
- Antivírus reclamando: o executável é novo e não tem assinatura digital de
  código. O hash está em SHA256SUMS; o fonte está em native/ no repositório.

Linux (binário de teste): ./kydra-linux-x64 --port 8787 — serve a mesma
interface, sem bandeja (o Windows é o alvo do app).
`;

const licenca = `KYDRA LAUNCHER ${pkg.version}
Licença: LGPL-3.0-or-later

O jogo HORIZON (github.com/horizon-rust/horizon) também é LGPL-3.0-or-later.
Minecraft é marca da Mojang/Microsoft. Este launcher não distribui arquivos do
jogo: usa a instalação do jogador ou baixa da Mojang com a conta dele.

Interface: HTML/CSS/JS próprios, sem framework. Executável: C compilado com
zig (github.com/ziglang/zig), servidor HTTP embutido, biblioteca padrão do
Windows + UCRT.

Fonte completo: native/src/main.c (Windows), native/src/main_posix.c (Linux),
src/ (interface), tools/ (build). Nenhuma biblioteca de terceiros é linkada
além do próprio sistema.
`;

await fs.mkdir(DIST, { recursive: true });
await fs.writeFile(path.join(DIST, "LEIA-ME.txt"), readme);
await fs.writeFile(path.join(DIST, "LICENCA.txt"), licenca);

// --- windows --------------------------------------------------------------
const winExe = path.join(DIST, "win", "kydra.exe");
if (await exists(winExe)) {
  if (await exists(path.join(ROOT, "native/win/kydra.ico"))) {
    await fs.copyFile(path.join(ROOT, "native/win/kydra.ico"), path.join(DIST, "win", "kydra.ico"));
  }

  const info = await peInfo(winExe);
  const size = (await fs.stat(winExe)).size;
  const hash = await sha256(winExe);

  await fs.writeFile(
    path.join(DIST, "win", "PROPS.txt"),
    `kydra.exe — Kydra Launcher ${pkg.version}

Formato      ${info.format}
Máquina      ${info.machine}
Subsistema   ${info.subsystem}
Tamanho      ${size} bytes (${(size / 1024).toFixed(0)} KB)
SHA-256      ${hash}
Assinatura   nenhuma (build local; ver SHA256SUMS)

Conteúdo embutido: index.html, src/ (JS + CSS), assets/ (arte), ícone e
VERSIONINFO. O executável não lê nada do disco além de si mesmo.
`
  );

  lines.push(`win/kydra.exe   ${info.format}  ${(size / 1024).toFixed(0)} KB  subsistema ${info.subsystem}`);
  sums.push([hash, "win/kydra.exe"]);
}

// --- linux ----------------------------------------------------------------
const linuxBin = path.join(DIST, "linux", "kydra-linux-x64");
if (await exists(linuxBin)) {
  const size = (await fs.stat(linuxBin)).size;
  const hash = await sha256(linuxBin);
  lines.push(`linux/kydra-linux-x64   ELF x86-64   ${(size / 1024).toFixed(0)} KB`);
  sums.push([hash, "linux/kydra-linux-x64"]);
}

if (!sums.length) {
  console.error("nada em dist/ para empacotar — rode tools/build-exe.sh primeiro");
  process.exit(1);
}

await fs.writeFile(
  path.join(DIST, "SHA256SUMS"),
  sums.map(([h, f]) => `${h}  ${f}`).join("\n") + "\n"
);

console.log("dist/ organizada:");
for (const l of lines) console.log("  " + l);
console.log("  LEIA-ME.txt, LICENCA.txt, SHA256SUMS");
