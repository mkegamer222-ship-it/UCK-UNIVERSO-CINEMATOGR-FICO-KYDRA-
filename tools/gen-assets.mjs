#!/usr/bin/env node
/**
 * tools/gen-assets.mjs — embute a interface dentro do executável.
 *
 * Gera native/src/assets.h com um array de { path, data, size } para cada
 * arquivo que o launcher precisa servir: index.html, src/** e assets/**.
 *
 * O .exe fica autossuficiente: nada de pasta "ui" ao lado, nada de caminho
 * relativo que quebra quando o usuário move o arquivo.
 *
 *   node tools/gen-assets.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDE = ["index.html", "src", "assets"];
const SKIP_EXT = new Set([".md", ".txt", ".map"]);

async function walk(entry) {
  const abs = path.join(ROOT, entry);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) return [];
  if (stat.isFile()) return [abs];

  const out = [];
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(abs, e.name);
    if (e.isDirectory()) {
      // dados de teste/planilha não entram no executável
      if (["node_modules", ".git", "screenshots"].includes(e.name)) continue;
      out.push(...(await walk(path.relative(ROOT, child))));
    } else if (!SKIP_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(child);
    }
  }
  return out;
}

/** C array literal para bytes. */
function bytesToC(buf, perLine = 24) {
  const parts = [];
  for (let i = 0; i < buf.length; i += perLine) {
    parts.push(
      "    " +
        [...buf.subarray(i, i + perLine)]
          .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
          .join(",") +
        ","
    );
  }
  return parts.join("\n");
}

const files = [];
for (const entry of INCLUDE) files.push(...(await walk(entry)));

if (!files.length) {
  console.error("nada para embutir — rode a partir da raiz do repositório");
  process.exit(1);
}

const chunks = [];
const rows = [];
let total = 0;

for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const data = await fs.readFile(abs);
  total += data.length;
  const sym = `asset_${rows.length}`;
  chunks.push(`static const unsigned char ${sym}[] = {\n${bytesToC(data)}\n};`);
  rows.push(`    { "${rel}", ${sym}, ${data.length} },`);
}

const header = `/* Gerado por tools/gen-assets.mjs — NÃO EDITE.
 * ${files.length} arquivos, ${(total / 1024).toFixed(1)} KB embutidos.
 * Fonte: index.html, src/ (js+css), assets/ (arte). */
#ifndef KYDRA_ASSETS_H
#define KYDRA_ASSETS_H

typedef struct {
    const char *path;          /* caminho relativo, ex.: "src/js/app.js" */
    const unsigned char *data;
    unsigned long size;
} KydraAsset;

${chunks.join("\n\n")}

static const KydraAsset g_assets[] = {
${rows.join("\n")}
};

static const unsigned long g_asset_count = ${files.length};

#endif /* KYDRA_ASSETS_H */
`;

const outFile = path.join(ROOT, "native/src/assets.h");
await fs.writeFile(outFile, header);

console.log(
  `assets.h gerado: ${files.length} arquivos, ${(total / 1024).toFixed(1)} KB ` +
    `(${(header.length / 1024).toFixed(1)} KB de C)`
);
