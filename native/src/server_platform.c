/* ==========================================================================
 * server_platform.c — a única parte do servidor que conhece o sistema.
 *
 * Duas coisas, e só: como enviar bytes nesta conexão e como ler a primeira
 * linha + cabeçalhos + corpo de uma requisição.
 * ========================================================================== */

#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "kydra_server.h"

#ifdef _WIN32
#include <winsock2.h>
typedef SOCKET kydra_fd;
#else
#include <unistd.h>
#include <sys/socket.h>
typedef int kydra_fd;
#endif

/* ---------------------------------------------------------------- envio -- */

static void send_bytes(KydraReq *r, const char *data, unsigned long len) {
    unsigned long sent = 0;
    kydra_fd fd = (kydra_fd)r->fd;
    while (sent < len) {
        int n = (int)send(fd, data + sent, (int)(len - sent), 0);
        if (n <= 0) return;
        sent += (unsigned long)n;
    }
}

void kydra_pack(KydraReq *r, int kind, int fd, const char *raw) {
    (void)kind;
    r->send = send_bytes;
    r->fd = fd;
    r->path = "/";
    r->method = "GET";
    r->body = "";

    static char path_buf[1024];
    static char method_buf[8];
    memset(path_buf, 0, sizeof path_buf);
    memset(method_buf, 0, sizeof method_buf);

    sscanf(raw, "%7s %1023s", method_buf, path_buf);
    r->method = method_buf;
    r->path = path_buf;

    const char *sep = strstr(raw, "\r\n\r\n");
    if (sep) r->body = sep + 4;
}
