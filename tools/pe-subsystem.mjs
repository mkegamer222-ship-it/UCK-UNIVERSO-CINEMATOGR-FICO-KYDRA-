#!/usr/bin/env node
/**
 * tools/pe-subsystem.mjs — ajusta o subsistema de um .exe do Windows.
 *
 * O zig (0.17) ignora `-mwindows` e sempre marca o executável como console,
 * o que faria o Windows abrir uma janela preta junto do app. O campo é um
 * WORD no Optional Header (offset +68 no PE32+ / +68 no PE32), então definir
 * aqui é mais confiável do que brigar com o linker.
 *
 *   2 = GUI (sem console)   3 = console
 *
 *   node tools/pe-subsystem.mjs dist/win/kydra.exe 2
 */

import fs from "node:fs";

const [, , file, valueArg] = process.argv;
const subsystem = Number(valueArg ?? 2);

if (!file || ![2, 3].includes(subsystem)) {
  console.error("uso: node tools/pe-subsystem.mjs <arquivo.exe> <2|3>");
  process.exit(1);
}

const buf = fs.readFileSync(file);
if (buf.toString("ascii", 0, 2) !== "MZ") {
  console.error("não é um executável PE (falta o 'MZ')");
  process.exit(1);
}

const peOffset = buf.readUInt32LE(0x3c);
if (buf.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
  console.error("assinatura PE inválida");
  process.exit(1);
}

const optHeader = peOffset + 24;
const magic = buf.readUInt16LE(optHeader);
const expected = magic === 0x20b ? "PE32+" : magic === 0x10b ? "PE32" : null;
if (!expected) {
  console.error(`optional header desconhecido: 0x${magic.toString(16)}`);
  process.exit(1);
}

const before = buf.readUInt16LE(optHeader + 68);
buf.writeUInt16LE(subsystem, optHeader + 68);
fs.writeFileSync(file, buf);

console.log(
  `${file}: ${expected} — subsistema ${before} → ${subsystem} ` +
    `(${subsystem === 2 ? "janela, sem console" : "console"})`
);
