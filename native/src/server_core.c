/* ==========================================================================
 * server_core.c — núcleo HTTP do Kydra, sem plataforma.
 *
 * Compilado nos dois executáveis (Windows e Linux). Nada aqui conhece
 * winsock nem <sys/socket.h>: bytes entram pelo KydraReq.send, que cada
 * plataforma preenche em kydra_pack().
 * ========================================================================== */

#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "kydra_server.h"

/* Comparação sem caixa que funciona nos dois lados (no Windows é a do CRT). */
#ifdef _WIN32
#include <winsock2.h>
typedef SOCKET kydra_fd;
#define KYDRA_INVALID INVALID_SOCKET
#ifndef strcasecmp
#define strcasecmp _stricmp
#endif
#else
#include <unistd.h>
#include <strings.h>
#include <sys/socket.h>
typedef int kydra_fd;
#define KYDRA_INVALID (-1)
#endif

/* ------------------------------------------------------------------ util -- */

const char *kydra_mime(const char *path) {
    const char *dot = strrchr(path, '.');
    if (!dot) return "application/octet-stream";
    if (!strcasecmp(dot, ".html")) return "text/html; charset=utf-8";
    if (!strcasecmp(dot, ".js") || !strcasecmp(dot, ".mjs")) return "text/javascript; charset=utf-8";
    if (!strcasecmp(dot, ".css")) return "text/css; charset=utf-8";
    if (!strcasecmp(dot, ".json")) return "application/json; charset=utf-8";
    if (!strcasecmp(dot, ".svg")) return "image/svg+xml";
    if (!strcasecmp(dot, ".png")) return "image/png";
    if (!strcasecmp(dot, ".jpg") || !strcasecmp(dot, ".jpeg")) return "image/jpeg";
    if (!strcasecmp(dot, ".webp")) return "image/webp";
    if (!strcasecmp(dot, ".ico")) return "image/x-icon";
    return "application/octet-stream";
}

static void url_decode(const char *in, char *out, size_t cap) {
    size_t o = 0;
    for (size_t i = 0; in[i] && o + 1 < cap; i++) {
        if (in[i] == '%' && in[i + 1] && in[i + 2]) {
            char hex[3] = {in[i + 1], in[i + 2], 0};
            out[o++] = (char)strtol(hex, NULL, 16);
            i += 2;
        } else if (in[i] == '?') {
            break;
        } else {
            out[o++] = in[i];
        }
    }
    out[o] = 0;
}

/* Resolve "." e ".." sem tocar no disco: o resultado é sempre um caminho
 * relativo limpo, e qualquer tentativa de sair da raiz morre aqui. */
static void normalize(const char *in, char *out, size_t cap) {
    char stack[32][96];
    int depth = 0;

    const char *p = in;
    while (*p) {
        while (*p == '/') p++;
        if (!*p) break;

        char seg[96];
        size_t n = 0;
        while (*p && *p != '/' && n + 1 < sizeof seg) seg[n++] = *p++;
        seg[n] = 0;

        if (!strcmp(seg, ".")) continue;
        if (!strcmp(seg, "..")) {
            if (depth > 0) depth--;
            continue;
        }
        if (depth < 32) {
            memcpy(stack[depth], seg, n + 1);
            depth++;
        }
    }

    size_t o = 0;
    if (cap) out[0] = 0;
    for (int i = 0; i < depth && o + 1 < cap; i++) {
        if (o) out[o++] = '/';
        for (const char *c = stack[i]; *c && o + 1 < cap; c++) out[o++] = *c;
    }
    if (cap) out[o] = 0;
}

const KydraAsset *kydra_find_asset(const char *path) {
    char decoded[512] = {0};
    char clean[512] = {0};
    url_decode(path, decoded, sizeof decoded - 1);
    normalize(decoded, clean, sizeof clean - 1);

    const char *p = clean;
    if (*p == 0) p = "index.html";

    for (unsigned long i = 0; i < g_asset_count; i++) {
        if (!strcasecmp(g_assets[i].path, p)) return &g_assets[i];
    }
    return NULL;
}

unsigned long kydra_asset_count(void) { return g_asset_count; }

/* Extrai "chave":"valor" de um JSON raso. */
static int json_field(const char *json, const char *key, char *out, size_t cap) {
    char needle[128];
    snprintf(needle, sizeof needle, "\"%s\"", key);
    const char *p = strstr(json, needle);
    if (!p) return 0;
    p = strchr(p + strlen(needle), ':');
    if (!p) return 0;
    p++;
    while (*p == ' ' || *p == '\t') p++;
    if (*p != '"') return 0;
    p++;
    size_t o = 0;
    while (*p && *p != '"' && o + 1 < cap) out[o++] = *p++;
    out[o] = 0;
    return 1;
}

/* --------------------------------------------------------------- resposta -- */

void kydra_send(KydraReq *r, int status, const char *mime, const char *body, unsigned long len) {
    const char *reason = status == 200 ? "OK"
                       : status == 202 ? "Accepted"
                       : status == 404 ? "Not Found"
                       : status == 405 ? "Method Not Allowed"
                       : status == 500 ? "Internal Server Error"
                       : "OK";
    char head[512];
    int n = snprintf(head, sizeof head,
                     "HTTP/1.1 %d %s\r\n"
                     "Content-Type: %s\r\n"
                     "Content-Length: %lu\r\n"
                     "Cache-Control: no-cache\r\n"
                     "X-Content-Type-Options: nosniff\r\n"
                     "Connection: close\r\n"
                     "\r\n",
                     status, reason, mime, len);
    r->send(r, head, (unsigned long)n);
    if (body && len) r->send(r, body, len);
}

/* ------------------------------------------------------------------- api -- */

KydraRoute kydra_route(KydraReq *r, char **body, unsigned long *len,
                       const char **mime, int *status) {
    /* Só /api/ é API. Qualquer outro caminho é arquivo embutido e quem chama
     * resolve com kydra_find_asset(). */
    if (strncmp(r->path, "/api/", 5) != 0) return KYDRA_ASSET;

    *mime = "application/json; charset=utf-8";

    if (!strcmp(r->path, "/api/health")) {
        static char buf[256];
        snprintf(buf, sizeof buf,
                 "{\"ok\":true,\"mode\":\"backend\",\"launcher\":\"kydra/%s\","
                 "\"runtime\":\"native\",\"assets\":%lu}",
                 KYDRA_VERSION, g_asset_count);
        *body = buf;
        *len = strlen(buf);
        *status = 200;
        return KYDRA_HANDLED;
    }

    if (!strcmp(r->path, "/api/versions")) {
        if (strcmp(r->method, "GET")) {
            *status = 405;
            *body = (char *)"{\"error\":\"use GET\"}";
            *len = strlen(*body);
            return KYDRA_HANDLED;
        }
        const KydraAsset *cat = kydra_find_asset("src/js/data/builds.json");
        if (!cat) {
            *status = 500;
            *body = (char *)"{\"error\":\"catalogo ausente no executavel\"}";
            *len = strlen(*body);
            return KYDRA_HANDLED;
        }
        unsigned long need = cat->size + 64;
        char *buf = (char *)malloc(need);
        if (!buf) {
            *status = 500;
            *body = (char *)"{\"error\":\"sem memoria\"}";
            *len = strlen(*body);
            return KYDRA_HANDLED;
        }
        int n = snprintf(buf, need, "{\"versions\":%.*s}", (int)cat->size,
                         (const char *)cat->data);
        *body = buf;
        *len = (unsigned long)n;
        *status = 200;
        return KYDRA_HANDLED;
    }

    static const char *jobs[] = {"install", "prepare", "play"};
    for (int i = 0; i < 3; i++) {
        char route[32];
        snprintf(route, sizeof route, "/api/%s", jobs[i]);
        if (!strcmp(r->path, route)) {
            static char buf[384];
            char id[96] = "unknown";
            if (strcmp(r->method, "POST")) {
                *status = 405;
                *body = (char *)"{\"error\":\"use POST\"}";
                *len = strlen(*body);
                return KYDRA_HANDLED;
            }
            if (!json_field(r->body, "id", id, sizeof id))
                json_field(r->body, "buildId", id, sizeof id);
            snprintf(buf, sizeof buf,
                     "{\"ok\":true,\"queued\":\"%s\",\"id\":\"%s\","
                     "\"note\":\"agendado; o trabalho real e o horizon-prepare\"}",
                     jobs[i], id);
            *body = buf;
            *len = strlen(buf);
            *status = 202;
            return KYDRA_HANDLED;
        }
    }

    *status = 404;
    *body = (char *)"{\"error\":\"rota inexistente\"}";
    *len = strlen(*body);
    return KYDRA_HANDLED;
}
