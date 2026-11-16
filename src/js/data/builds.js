/**
 * data/builds.js — dados de referência do Horizon para a interface.
 *
 * O catálogo de builds mora em `builds.json`, ao lado deste arquivo, para que o
 * backend (Node em `backend/server.mjs` e Rust em `backend-rust/`) leia o MESMO
 * arquivo. Uma verdade só, sem cópia divergente.
 *
 * Se o backend responde `GET /api/versions`, é ele quem manda; este catálogo é
 * o plano B (modo demonstração), que mantém a interface navegável offline.
 *
 * Formato de cada build:
 *   id, tag ("nightly" | "stable"), version, date, sizeBytes, parity,
 *   harnesses, notes[]
 */

import catalog from "./builds.json" with { type: "json" };

export const HORIZON_REPO = "horizon-rust/horizon";

export const builds = catalog;

export const releases = builds;

export const patches = [
  {
    id: "p-20261116",
    title: "Nightly 20261116 — a Mod API chega ao launcher",
    date: "2026-11-16",
    tag: "nightly",
    highlight: true,
    items: [
      {
        t: "Mod API integrada",
        d: "Pacotes de mod agora entram pelo launcher, com permissões declaradas e checagem antes de rodar. Mods Java do Modrinth aparecem marcados como Funciona, Em parte ou Não roda.",
      },
      {
        t: "Servidor dedicado no single-player",
        d: "O modo single-player passou a rodar só na thread do servidor: o caminho antigo, dentro da janela, foi removido junto com o carregamento de mundo duplicado.",
      },
      {
        t: "Parity: comandos",
        d: "/loot give para um inventário cheio não joga mais o item no chão — o comportamento agora espelha o vanilla.",
      },
    ],
  },
  {
    id: "p-20261115",
    title: "Licença LGPL-3.0-or-later e limpeza do fork",
    date: "2026-11-15",
    tag: "stable",
    items: [
      {
        t: "Nova licença",
        d: "O projeto inteiro passa de MIT para LGPL-3.0-or-later, incluindo o launcher.",
      },
      {
        t: "Launcher sem herança",
        d: "Nomes, ícones, chaves de assinatura e empacotamento do fork antigo saíram. O Horizon agora publica com a própria identidade.",
      },
    ],
  },
  {
    id: "p-20261110",
    title: "Estável 20261110 — servidores confiáveis",
    date: "2026-11-10",
    tag: "stable",
    items: [
      {
        t: "Backup e rollback",
        d: "Atualização de servidor baixa, valida e troca; se não subir, volta sozinha para a versão anterior.",
      },
      {
        t: "Prepare mais barato",
        d: "Reaproveita jars de jogo e bibliotecas verificados por checksum de outra versão instalada — só pede a instalação original do Minecraft quando não existe cópia válida.",
      },
    ],
  },
  {
    id: "p-20261030",
    title: "Servidores com painel e amigos por Tailscale",
    date: "2026-10-30",
    tag: "stable",
    items: [
      {
        t: "Painel web",
        d: "Estado, jogadores online, TPS, MSPT e RAM na janela e no navegador, tudo falando com o `horizon-server`.",
      },
      {
        t: "Fora da rede local",
        d: "Convite por Tailscale, um computador por vez. O Horizon nunca liga o Funnel.",
      },
    ],
  },
  {
    id: "p-20261012",
    title: "Primeira release pública",
    date: "2026-10-12",
    tag: "stable",
    items: [
      {
        t: "Minecraft: Java Edition reescrito em Rust",
        d: "281 harnesses diferenciais comparando com o vanilla, 88% de parity na primeira publicação.",
      },
    ],
  },
];

/** Roadmap do Horizon (o que vem depois). */
export const roadmap = [
  {
    id: "r-modapi",
    title: "Mod API estável",
    status: "em andamento",
    progress: 62,
    d: "Contratos públicos de mod, carregamento sandboxed e catálogo próprio. O que hoje é nightly vira contrato.",
  },
  {
    id: "r-parity",
    title: "100% de parity com o vanilla",
    status: "em andamento",
    progress: 91,
    d: "279 harnesses diferenciais. Falta o que depende de timing de tick e de ordem de pacotes raros.",
  },
  {
    id: "r-redstone",
    title: "Redstone sem diferença de tick",
    status: "planejado",
    progress: 24,
    d: "Ordem de atualização determinística e simulação paralela por região sem mudar o resultado.",
  },
  {
    id: "r-mobile",
    title: "Cliente em dispositivos móveis",
    status: "planejado",
    progress: 8,
    d: "Mesmo núcleo, renderização wgpu e controles por toque. Sem porta separada, sem mundo diferente.",
  },
  {
    id: "r-curseforge",
    title: "CurseForge no navegador de mods",
    status: "planejado",
    progress: 30,
    d: "Download direto com SHA-512 e importação de packs .zip do CurseForge.",
  },
  {
    id: "r-shaders",
    title: "Shaders compilados em cache",
    status: "concluído",
    progress: 100,
    d: "Entregue em 20261022: pipeline de packs com cache de compilação por GPU.",
  },
];

/** Catálogo de mods (para a página Mods). */
export const mods = [
  { id: "sodium", name: "Sodium", source: "Modrinth", versions: "26.3", runs: "works", d: "Renderização de chunks em paralelo; nenhuma mudança de gameplay.", downloads: "9,1 M" },
  { id: "lithium", name: "Lithium", source: "Modrinth", versions: "26.3", runs: "works", d: "Otimizações de simulação: IA, colisão, redstone.", downloads: "7,4 M" },
  { id: "iris", name: "Iris Shaders", source: "Modrinth", versions: "26.3", runs: "partial", d: "Carrega packs de shader. Falta o pipeline de sombras em algumas GPUs.", downloads: "5,8 M" },
  { id: "jei", name: "JEI", source: "Modrinth", versions: "26.3", runs: "works", d: "Receitas no inventário, integrado à API de mods do Horizon.", downloads: "11,2 M" },
  { id: "create", name: "Create", source: "Modrinth", versions: "26.3", runs: "partial", d: "Eixos, engrenagens e esteiras já rodam; faltam as máquinas com contrato de tick.", downloads: "8,0 M" },
  { id: "cobblemon", name: "Cobblemon", source: "Modrinth", versions: "26.3", runs: "not-yet", d: "Depende de eventos de spawn que a API de mods ainda não expõe.", downloads: "4,6 M" },
];

export const modpacks = [
  { id: "better-mc", name: "Better MC [FORGE]", source: "Modrinth", size: "420 MB", coverage: 71, mods: 214 },
  { id: "adrenaline", name: "Adrenaline", source: "Modrinth", size: "18 MB", coverage: 94, mods: 9 },
  { id: "fabulously", name: "Fabulously Optimized", source: "Modrinth", size: "62 MB", coverage: 89, mods: 38 },
  { id: "atm10", name: "All the Mods 10", source: "CurseForge", size: "1,3 GB", coverage: 43, mods: 402 },
];

export const serverTemplates = [
  { id: "vanilla", name: "Survival vanilla", d: "Mundo novo, dificuldade normal, só amigos.", icon: "box" },
  { id: "creative", name: "Criativo para construir", d: "Voo liberado, dificuldade pacífica, 10 jogadores.", icon: "instances" },
  { id: "modded", name: "Modpacks", d: "Um mundo com o modpack que você escolher.", icon: "packs" },
];
