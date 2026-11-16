# API do Kydra

Base: `http://localhost:8787/api` (ajustável com `PORT`). JSON em tudo.
Há duas implementações do mesmo contrato: `backend/server.mjs` (Node, o que roda por padrão) e
`backend-rust/` (Rust, sem dependências). Qualquer backend novo deve manter **este contrato**,
para que a interface não mude.

## GET /api/health

Usado como sonda na inicialização (timeout de 1,2 s). Se falhar, a interface entra em modo
demonstração.

```json
{ "ok": true, "mode": "backend", "launcher": "kydra/0.1.0", "platform": "linux/x64", "node": "v22.22.3" }
```

## GET /api/versions

Catálogo de builds, mais novo primeiro.

```json
{
  "versions": [
    {
      "id": "v20261116",
      "tag": "nightly",          // "nightly" | "stable"
      "version": "20261116",
      "date": "2026-11-16",      // ISO, dia
      "sizeBytes": 17283072,
      "parity": 91,              // % de harnesses diferenciais passando
      "harnesses": 279,
      "notes": ["…", "…"]        // lista curta, texto puro
    }
  ]
}
```

## POST /api/install

```json
{ "id": "v20261116" }
→ 202 { "ok": true, "queued": "install", "id": "v20261116" }
```

O backend real: baixa o tarball da release da plataforma, confere sha256, extrai em
`<dataDir>/versions/<id>/` e grava `version.json`.

## POST /api/prepare

```json
{ "id": "v20261116" }
→ 202 { "ok": true, "queued": "prepare", "id": "v20261116" }
```

Equivale a `horizon-prepare`: confere/reaproveita `client-26.3.jar`, bibliotecas e assets da sua
instalação do Minecraft (ou de outra versão do Horizon já verificada por checksum), e copia os
sons para o asset store.

## POST /api/play

```json
{ "buildId": "v20261116", "instanceId": "default" }
→ 202 { "ok": true, "queued": "play", "pid": 12345 }
```

Faz spawn do `horizon-client` com a instância escolhida, memória e argumentos das configurações.
`pid` pode vir `null` se o processo ainda está subindo.

## Eventos de progresso (a implementar)

O modo demonstração já simula progresso (`{ progress: 0..100 }`) e linhas de log. O próximo passo
é o mesmo fluxo por **SSE**:

```
GET /api/events            text/event-stream
event: log      data: {"line":"verificando sha256 … ok","kind":"ok"}
event: progress data: {"job":"install","id":"v20261116","pct":42}
event: done     data: {"job":"install","id":"v20261116","ok":true}
```

Enquanto não existir, a interface mostra progresso simulado e continua funcionando.

## Erros

Sempre `{ "error": "mensagem em português" }`, com o status HTTP certo:
`400` entrada inválida · `404` rota/arquivo inexistente · `409` já instalado ou jogo livre ·
`500` falha inesperada (traga o log no corpo).
