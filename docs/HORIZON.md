# Horizon — o que o launcher está alimentando

Referência: <https://github.com/horizon-rust/horizon>

## Em uma frase

Minecraft: Java Edition 26.3 reescrito do zero em **Rust**, verificado contra o jogo original com
**281 harnesses diferenciais**. O Kydra é a porta de entrada: baixa a build, prepara os arquivos
do jogo e abre o cliente ou um servidor.

## O que o launcher precisa entregar para o jogo abrir

O Horizon não distribui arquivos da Mojang. Ele precisa de uma instalação do Minecraft 26.3 — a
sua, do launcher oficial — e monta o resto em volta dela.

| Peça | De onde vem |
| --- | --- |
| `horizon-client` / `horizon-server` | release assinada do GitHub, por plataforma |
| `client-26.3.jar` | a sua instalação do Minecraft (ou download da Mojang, com conta que possui o jogo) |
| Bibliotecas nativas da plataforma | sua instalação, ou baixadas e conferidas por sha1 |
| Assets (`objects`, `indexes`) | idem |
| Sons | copiados para o asset store do Horizon (`horizon-prepare sounds`) |
| Java 25 | runtime gerenciado pelo launcher, ou o do sistema |

Tudo é conferido por checksum (sha1 na instalação local, sha256 no tarball da release). Nada de
espelho: quando baixa, baixa da Mojang.

## Conceitos que a interface reflete

- **Builds** — cada release instala na própria pasta; remover não deixa resíduo. Nightly é o que
  compilou hoje; estável é testada uma vez ao dia.
- **Prepare** — reaproveita jars e bibliotecas já verificados de outra versão do Horizon, então a
  instalação original do Minecraft só é obrigatória quando não existe cópia válida.
- **Instâncias** — pastas de jogo separadas (`instances/<nome>/`), cada uma com mundos, opções e
  packs. A primeira é a pasta principal do jogo; renomear não move nada.
- **Mods e Modpacks** — o registro do Horizon e o Modrinth; cada mod Java é marcado como
  **Funciona**, **Em parte** ou **Não roda ainda** no Horizon. Um modpack Java (`.mrpack`,
  CurseForge zip, instância Prism/MultiMC) ganha um relatório de cobertura e o botão **Portar**
  copia os jars que já rodam hoje.
- **Servidores** — o launcher é só a interface: tudo passa pelo `horizon-server` (`init`, `config`,
  `start`, `backup`, `restore`, `update`, `service`) e pela API de controle dele. Amigos fora da
  rede local usam Tailscale, um computador por vez; o Horizon nunca liga o Funnel.
- **Parity** — a porcentagem de harnesses diferenciais passando. É a métrica honesta de "quanto
  isso se comporta como o vanilla".

## O que o Kydra NÃO faz

- Não redistribui o jogo, nem jars, nem assets.
- Não baixa de espelhos: só Mojang, GitHub e as APIs de mods.
- Não guarda token em texto puro: o lugar é o chaveiro do sistema.
- Não mexe nos seus mundos ao remover uma build.

## Nota de licença

O Horizon passou de MIT para **LGPL-3.0-or-later** em novembro de 2026. O Kydra referencia o
projeto e consome as releases; não copia código do jogo.
