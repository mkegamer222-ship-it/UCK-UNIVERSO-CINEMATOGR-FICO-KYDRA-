/* ==========================================================================
 * posix_main.c — entrada do Kydra fora do Windows (Linux).
 *
 * O servidor (rotas, MIME, assets embutidos, JSON) é EXATAMENTE o mesmo do
 * kydra.exe: ele mora em server_core.c, que não conhece Win32. Aqui só existe
 * a casca: sockets POSIX e o processo que fica vivo.
 *
 *   ./kydra-linux-x64            # http://127.0.0.1:8787
 *   ./kydra-linux-x64 --port 9000
 *
 * Não há bandeja no Linux (o alvo do app é o Windows); o navegador abre à mão.
 * ========================================================================== */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

#include "kydra_server.h"

static void pump(int fd) {
    char req[8192];
    ssize_t n = recv(fd, req, sizeof req - 1, 0);
    if (n <= 0) return;
    req[n] = 0;

    KydraReq r;
    kydra_pack(&r, 0, fd, req);

    char *body = NULL;
    unsigned long len = 0;
    const char *mime = NULL;
    int status = 0;

    if (kydra_route(&r, &body, &len, &mime, &status) == KYDRA_ASSET) {
        const KydraAsset *a = kydra_find_asset(r.path);
        if (!a) {
            /* Não está embutido: 404, e nada de deref de ponteiro nulo. */
            kydra_send(&r, 404, "text/plain; charset=utf-8", "404", 3);
            return;
        }
        body = (char *)a->data;
        len = a->size;
        mime = kydra_mime(a->path);
        status = 200;
    }
    kydra_send(&r, status, mime, body, (size_t)len);
}

int main(int argc, char **argv) {
    int port = 8787;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--port") && i + 1 < argc) port = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--help")) {
            printf("Kydra Launcher (nativo, assets embutidos)\n"
                   "  --port N   porta (padrão 8787)\n"
                   "  saída: a interface abre em http://127.0.0.1:N\n");
            return 0;
        }
    }

    int srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv < 0) { perror("socket"); return 1; }
    int yes = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons((unsigned short)port);
    if (bind(srv, (struct sockaddr *)&addr, sizeof addr) != 0) {
        fprintf(stderr, "porta %d em uso. Tente: --port 9000\n", port);
        return 1;
    }
    listen(srv, 16);

    printf("Kydra Launcher %lu arquivos embutidos → http://127.0.0.1:%d\n",
           kydra_asset_count(), port);
    fflush(stdout);

    for (;;) {
        int c = accept(srv, 0, 0);
        if (c < 0) continue;
        pump(c);
        close(c);
    }
}
