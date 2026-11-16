/* ==========================================================================
 * kydra_server.h — o núcleo HTTP do Kydra, independente de plataforma.
 *
 * server_core.c é compilado tanto no Windows (kydra.exe) quanto no Linux
 * (kydra-linux-x64): as rotas, o MIME, o JSON e a busca nos assets embutidos
 * são os mesmos. O que muda é só como se envia e recebe bytes, e isso entra
 * pelo KydraReq (callback de envio).
 * ========================================================================== */

#ifndef KYDRA_SERVER_H
#define KYDRA_SERVER_H

#include "assets.h"

#define KYDRA_VERSION "0.1.0"

typedef enum { KYDRA_ASSET = 0, KYDRA_HANDLED = 1 } KydraRoute;

typedef struct KydraReq KydraReq;

/** Envia bytes por esta conexão (implementado por plataforma). */
typedef void (*KydraSendFn)(KydraReq *r, const char *data, unsigned long len);

struct KydraReq {
    KydraSendFn send;
    int fd;          /* SOCKET no Windows, int no POSIX */
    const char *path;   /* "/api/health", "/", "/src/js/app.js" */
    const char *method; /* "GET", "POST" */
    const char *body;   /* corpo da requisição (pode ser "") */
};

/** Preenche o KydraReq com o callback de envio da plataforma. */
void kydra_pack(KydraReq *r, int kind, int fd, const char *raw_request);

/** Trata as rotas da API. Devolve KYDRA_HANDLED quando já respondeu. */
KydraRoute kydra_route(KydraReq *r, char **body, unsigned long *len,
                       const char **mime, int *status);

const KydraAsset *kydra_find_asset(const char *path);
const char *kydra_mime(const char *path);
unsigned long kydra_asset_count(void);

/** Resposta HTTP completa (headers + corpo). */
void kydra_send(KydraReq *r, int status, const char *mime, const char *body, unsigned long len);

#endif /* KYDRA_SERVER_H */
