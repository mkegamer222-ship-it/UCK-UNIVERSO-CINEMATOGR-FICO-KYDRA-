# Kydra — sistema visual (tema verde)

A referência é o launcher do Horizon: sidebar escura, conteúdo em **linhas com divisores finos**,
título grande em serifada, um único botão primário por tela, muito ar. O Kydra troca o roxo pelo
**verde de aurora** e mantém a mesma calma.

## Princípios

1. **Um herói, uma ação.** Cada página tem um ponto de entrada; o resto é secundário.
2. **Linhas, não caixas.** Preferimos divisores de 1px a cartões com borda. Cartão só quando o
   conteúdo é de fato um bloco (mod, instância, servidor).
3. **O verde é sinal, não enfeite.** Verde = ação primária, sucesso, "pronto". Nunca em texto
   longo nem em fundos grandes.
4. **Texto de gente.** "Precisa preparar", "Já jogado há 3 dias" — não "ESTADO: PENDING_PREP".
5. **Escuro de verdade.** Fundo quase preto esverdeado (`#070b09`), não cinza azulado.

## Cor

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg-void` | `#040706` | fundo do app, atrás de tudo |
| `--bg` | `#070b09` | fundo do conteúdo |
| `--bg-elev` | `#0a100d` | painéis |
| `--accent` | `#3ee07f` | ação primária, foco, sucesso |
| `--accent-bright` | `#6df7a5` | hover, realce em texto curto |
| `--accent-deep` | `#1d9d57` | fim do gradiente do botão |
| `--teal` | `#2fd6b0` | dados secundários (TPS, RAM) |
| `--lime` | `#a8e05f` | acento terciário, avatares |
| `--warn` | `#f0c65c` | falta preparar, nightly |
| `--danger` | `#f2706b` | remover, erro |
| `--info` | `#6fb3ff` | selo informativo (concluído) |
| `--text` | `#eef5f0` | título e corpo principal |
| `--text-dim` | `#92a49a` | descrição |
| `--text-mute` | `#63756b` | metadados, kicker |

Contraste: `--text` sobre `--bg` passa AAA; `--text-dim` passa AA em 14px. Verde de ação é sempre
com texto escuro (`--accent-ink #08281a`), nunca com branco.

## Tipografia

- **Sans (Inter)**: tudo que é interface. Corpo 14px/1.55; títulos de seção 16–22px com
  `letter-spacing: -0.02em`; kicker 10,5px em caixa alta com `0.13em`.
- **Serif (Iowan/Palatino/Georgia)**: só o wordmark do herói e títulos de página grandes. É o que
  dá o ar editorial do Horizon sem imitá-lo.
- **Mono (JetBrains Mono)**: versões, tamanhos de arquivo, endereços de servidor, console. Sempre
  `font-variant-numeric: tabular-nums`.

## Espaço, raio, sombra

- Escala 4px: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 72.
- Raio: 5 (chip/btn pequeno), 8 (botão), 11 (painel de destaque), 16 (painel grande), 999 (pill).
- Sombra: quase só difusa para baixo (`--shadow-2`). Borda por `inset 0 0 0 1px` com branco a 6,5%
  — é o truque que mantém o escuro escuro sem ganhar contorno duro.
- Glow verde: só em botão primário e no pulso do console.

## Componentes

- **Botão primário** — gradiente vertical `#4dea8c → #25c96c`, texto escuro, altura 36 (46 quando
  é "Jogar"), brilho verde difuso.
- **Botão outline** — vidro (branco 4,5%) com contorno 14%.
- **Pills** — segmentado de 28px, item ativo em branco quase cheio sobre fundo escuro.
- **Linha** — 62px mínimos, título + subtítulo, ação à direita, divisor 1px. É o átomo da interface.
- **Chip** — 21px, caixa alta, 10,5px. Variantes: accent, warn, danger, info, plain.
- **Status** — ponto de 6px com halo de 3px. `ok` verde, `warn` amarelo, `busy` pulsando.
- **Toggle** — 40×23, ativo no gradiente verde com o knob escuro.
- **Console** — flutuante no canto inferior direito, fundo `rgba(4,9,7,.94)`, mono 11,5px/1.75.
- **Toast** — pill centralizada embaixo, ponto colorido por tipo.
- **Modal** — 480px, fundo `--bg-elev`, ações à direita, foco no confirmar.

## Movimento

- Curva padrão `cubic-bezier(.22,1,.36,1)`; rápido 120ms, médio 220ms, lento 420ms.
- Entrada de página: opacidade + 8px para cima.
- Abertura: wordmark com brilho respirando, barra de 2px correndo.
- `prefers-reduced-motion` e o ajuste "Reduzir movimento" desligam tudo (0,001ms).

## Layout

- Sidebar fixa de 236px (68px abaixo de 860px, só ícones). Conteúdo centralizado em 1080px.
- O herói ocupa `min(560px, 74vh)`; a grade abaixo tem 2 colunas (1 em telas estreitas).
- O conteúdo rola só no `<main>`; sidebar e console não se movem.

## Capturas

`design/screenshots/` guarda as telas de referência. Para atualizar, rode `npm start` e capture
`#/play`, `#/versions`, `#/settings`.
