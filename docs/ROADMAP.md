# Roadmap do Kydra

O que já está de pé e o que falta, sem data — só ordem de importância.

## Feito (0.1.0)

- [x] Casca, rotas por hash, sidebar, abertura, tema verde e claro.
- [x] Página Jogar com herói, dependências, versão/instância e console.
- [x] Versões: catálogo, instalar, remover, filtro por canal, detalhes.
- [x] Mods: busca, fontes, selo de compatibilidade, modpacks com cobertura.
- [x] Instâncias: criar, editar, cor, grupo, seleção.
- [x] Servidores: criar (com EULA), iniciar/parar/reiniciar, backup, métricas ao vivo.
- [x] Ajustes: conta, canal, memória, Java, menus, argumentos, aparência, dados.
- [x] Backend de referência com `/api` + fallback de demonstração.
- [x] 12 testes de fumaça em DOM real.

## Próximo (0.2.0)

- [ ] **Eventos de progresso por SSE** (`/api/events`) em vez do progresso simulado.
- [ ] **Login Microsoft de verdade** (device code, token no chaveiro do sistema).
- [ ] **Download da Mojang** com verificação de tamanho e sha1 arquivo por arquivo, com cancelar.
- [ ] **Detecção da instalação local** do Minecraft (Windows, Linux, macOS) e cache do resultado.
- [ ] **Persistir instalações** no backend (hoje o modo demo guarda no navegador).

## Depois (0.3.0)

- [ ] Backend Rust: reaproveitar os crates do Horizon (`horizon-platform`, `horizon-server-launch`)
      em vez do Node, mantendo o contrato de `docs/API.md`.
- [ ] Empacotamento desktop (Tauri ou GPUI, como o launcher oficial) com bandeja e abrir pasta.
- [ ] Importar build compilada de verdade (seleção de arquivo + assinatura marcada como não assinada).
- [ ] Atualização automática do launcher.
- [ ] i18n: a interface está em pt-BR; extrair strings para `lang/`.

## Ideias guardadas

- Histórico de sessões com gráfico de MSPT por mundo.
- Comparador de parity entre duas builds.
- "Modo enxuto": esconder tudo e deixar só o botão Jogar.
- Perfis de argumentos (vanilla, shaders, servidor local).
