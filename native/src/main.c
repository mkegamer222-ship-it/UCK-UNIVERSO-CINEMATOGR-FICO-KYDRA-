/* ==========================================================================
 * Kydra Launcher — app do Windows (kydra.exe).
 *
 * Um .exe pequeno, sem runtime instalado: a interface inteira (HTML, CSS, JS,
 * imagens) vai embutida, o servidor HTTP está em server_core.c (o MESMO do
 * build Linux) e o processo vive na bandeja do sistema.
 *
 *   kydra.exe                → 127.0.0.1:8787 e abre o navegador
 *   kydra.exe --port 9000    → outra porta
 *   kydra.exe --no-open      → só sobe o servidor
 *   kydra.exe --stop         → encerra a instância que estiver rodando
 *   kydra.exe --console      → anexa ao console do terminal (log)
 *   kydra.exe --version | --help
 *
 * Build: tools/build-exe.sh (zig, cross-compile para x86_64-windows-gnu).
 * ========================================================================== */

#define WIN32_LEAN_AND_MEAN
#define _CRT_SECURE_NO_WARNINGS
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "kydra_server.h"

#define DEFAULT_PORT 8787
#define MUTEX_NAME "Global\\KydraLauncherSingleton"
#define WM_TRAY (WM_APP + 1)
#define ID_TRAY_OPEN 1001
#define ID_TRAY_STOP 1002
#define ID_TRAY_QUIT 1003

static int g_port = DEFAULT_PORT;
static HANDLE g_mutex = NULL;
static NOTIFYICONDATAA g_nid;
static HWND g_hwnd = NULL;
static volatile LONG g_running = 1;

/* ------------------------------------------------------------- conexão -- */

/* Lê a requisição inteira (linha de pedido, cabeçalhos e corpo) num buffer
 * estático: a interface manda JSON pequeno, então 8 KB sobra. */
static const char *read_request(SOCKET s, char *buf, int cap) {
    int total = 0;
    int header_end = -1;

    while (total < cap - 1) {
        int n = recv(s, buf + total, cap - 1 - total, 0);
        if (n <= 0) break;
        total += n;
        buf[total] = 0;

        if (header_end < 0) {
            char *sep = strstr(buf, "\r\n\r\n");
            if (sep) {
                header_end = (int)(sep - buf) + 4;
                /* Content-Length diz quanto corpo ainda falta. */
                const char *cl = strstr(buf, "Content-Length:");
                if (!cl) cl = strstr(buf, "content-length:");
                long want = cl ? strtol(cl + 15, NULL, 10) : 0;
                long have = total - header_end;
                if (have >= want) break;
            }
        } else {
            break;
        }
    }
    buf[total] = 0;
    return buf;
}

static void handle_client(SOCKET s) {
    char raw[8192];
    if (read_request(s, raw, sizeof raw)[0] == '\0') return;

    KydraReq req;
    kydra_pack(&req, 0, (int)s, raw);

    if (!strcmp(req.method, "OPTIONS")) {
        kydra_send(&req, 200, "text/plain; charset=utf-8", "", 0);
        return;
    }

    char *payload = NULL;
    unsigned long plen = 0;
    const char *mime = NULL;
    int status = 0;

    if (kydra_route(&req, &payload, &plen, &mime, &status) == KYDRA_HANDLED) {
        kydra_send(&req, status, mime, payload, (size_t)plen);
        return;
    }

    /* Arquivo da interface, embutido no .exe. */
    const KydraAsset *a = kydra_find_asset(req.path);
    if (!a) {
        const char *msg = "404 — nao encontrado";
        kydra_send(&req, 404, "text/plain; charset=utf-8", msg, strlen(msg));
        return;
    }
    kydra_send(&req, 200, kydra_mime(a->path), (const char *)a->data, a->size);
}

static DWORD WINAPI server_thread(LPVOID param) {
    (void)param;
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) return 1;

    SOCKET srv = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (srv == INVALID_SOCKET) return 1;

    BOOL yes = TRUE;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, (const char *)&yes, sizeof yes);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK); /* só esta máquina */
    addr.sin_port = htons((u_short)g_port);

    if (bind(srv, (struct sockaddr *)&addr, sizeof addr) != 0) {
        MessageBoxA(NULL,
                    "A porta esta em uso. Feche outro Kydra (icone na bandeja) ou rode:\n\n"
                    "    kydra.exe --port 9000",
                    "Kydra Launcher", MB_ICONERROR | MB_OK);
        g_running = 0;
        return 1;
    }
    listen(srv, 16);

    printf("Kydra Launcher (nativo) → http://127.0.0.1:%d\n", g_port);
    fflush(stdout);

    while (g_running) {
        SOCKET c = accept(srv, NULL, NULL);
        if (c == INVALID_SOCKET) break;
        handle_client(c);
        closesocket(c);
    }

    closesocket(srv);
    WSACleanup();
    return 0;
}

/* ------------------------------------------------------------------ ui -- */

static void open_browser(void) {
    char url[128];
    snprintf(url, sizeof url, "http://127.0.0.1:%d/", g_port);
    ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
}

/* Ícone embutido no .exe (native/win/kydra.rc, ID 1). */
static HICON app_icon(int small) {
    int px = small ? GetSystemMetrics(SM_CXSMICON) : GetSystemMetrics(SM_CXICON);
    HICON ic = (HICON)LoadImageA(GetModuleHandleA(NULL), MAKEINTRESOURCEA(1), IMAGE_ICON,
                                 px, px, 0);
    if (!ic) ic = LoadIconA(NULL, IDI_APPLICATION);
    return ic;
}

static void tray_add(void) {
    memset(&g_nid, 0, sizeof g_nid);
    g_nid.cbSize = sizeof g_nid;
    g_nid.hWnd = g_hwnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAY;
    g_nid.hIcon = app_icon(1);
    snprintf(g_nid.szTip, sizeof g_nid.szTip, "Kydra Launcher %s — porta %d", KYDRA_VERSION, g_port);
    Shell_NotifyIconA(NIM_ADD, &g_nid);
}

static void tray_menu(void) {
    POINT pt;
    GetCursorPos(&pt);
    HMENU m = CreatePopupMenu();
    AppendMenuA(m, MF_STRING, ID_TRAY_OPEN, "Abrir Kydra");
    AppendMenuA(m, MF_STRING, ID_TRAY_STOP, "Parar o servidor");
    AppendMenuA(m, MF_SEPARATOR, 0, NULL);
    AppendMenuA(m, MF_STRING, ID_TRAY_QUIT, "Sair");
    SetForegroundWindow(g_hwnd);
    TrackPopupMenu(m, TPM_RIGHTBUTTON, pt.x, pt.y, 0, g_hwnd, NULL);
    DestroyMenu(m);
}

static LRESULT CALLBACK wnd_proc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_TRAY:
        if (LOWORD(lp) == WM_LBUTTONDBLCLK) open_browser();
        if (LOWORD(lp) == WM_RBUTTONUP) tray_menu();
        return 0;
    case WM_COMMAND:
        switch (LOWORD(wp)) {
        case ID_TRAY_OPEN:
            open_browser();
            return 0;
        case ID_TRAY_STOP:
        case ID_TRAY_QUIT:
            g_running = 0;
            Shell_NotifyIconA(NIM_DELETE, &g_nid);
            if (g_mutex) CloseHandle(g_mutex);
            PostQuitMessage(0);
            return 0;
        }
        return 0;
    case WM_DESTROY:
        g_running = 0;
        PostQuitMessage(0);
        return 0;
    case WM_ENDSESSION:
        g_running = 0;
        return 0;
    }
    return DefWindowProcA(hwnd, msg, wp, lp);
}

static void run_ui(void) {
    WNDCLASSA wc;
    memset(&wc, 0, sizeof wc);
    wc.lpfnWndProc = wnd_proc;
    wc.hInstance = GetModuleHandleA(NULL);
    wc.lpszClassName = "KydraTray";
    wc.hIcon = app_icon(0);
    RegisterClassA(&wc);

    /* Janela invisível: só existe para receber mensagens da bandeja. */
    g_hwnd = CreateWindowA("KydraTray", "Kydra", 0, 0, 0, 0, 0, HWND_MESSAGE, NULL,
                           wc.hInstance, NULL);
    tray_add();

    MSG msg;
    while (GetMessageA(&msg, NULL, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
    }
    Shell_NotifyIconA(NIM_DELETE, &g_nid);
}

/* ---------------------------------------------------------------- main -- */

/* `--console` anexa ao terminal de onde o .exe foi chamado (sem console
 * piscando para quem só deu dois cliques). */
static void attach_console(void) {
    if (AttachConsole(ATTACH_PARENT_PROCESS)) {
        freopen("CONOUT$", "w", stdout);
        freopen("CONOUT$", "w", stderr);
    }
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmdline, int show) {
    (void)hInst;
    (void)hPrev;
    (void)cmdline;
    (void)show;

    int argc = 0;
    LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    int open = 1;
    int want_stop = 0;
    int want_console = 0;

    for (int i = 1; i < argc; i++) {
        char a[64];
        WideCharToMultiByte(CP_UTF8, 0, argv[i], -1, a, sizeof a, NULL, NULL);
        if (!strcmp(a, "--port") && i + 1 < argc) {
            char p[16];
            WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, p, sizeof p, NULL, NULL);
            g_port = atoi(p);
        } else if (!strcmp(a, "--no-open")) {
            open = 0;
        } else if (!strcmp(a, "--stop")) {
            want_stop = 1;
        } else if (!strcmp(a, "--console")) {
            want_console = 1;
        } else if (!strcmp(a, "--version")) {
            char msg[80];
            snprintf(msg, sizeof msg, "Kydra Launcher %s (win-x64, nativo)", KYDRA_VERSION);
            MessageBoxA(NULL, msg, "Kydra Launcher", MB_ICONINFORMATION | MB_OK);
            return 0;
        } else if (!strcmp(a, "--help")) {
            MessageBoxA(NULL,
                        "Kydra Launcher " KYDRA_VERSION "\n\n"
                        "kydra.exe               sobe o servidor e abre a interface\n"
                        "kydra.exe --port 9000   usa outra porta\n"
                        "kydra.exe --no-open     nao abre o navegador\n"
                        "kydra.exe --stop        encerra a instancia em execucao\n"
                        "kydra.exe --console     mostra o log no terminal\n",
                        "Kydra Launcher", MB_ICONINFORMATION | MB_OK);
            return 0;
        }
    }
    if (argv) LocalFree(argv);

    if (want_console) {
        attach_console();
        printf("Kydra Launcher %s — porta %d\n", KYDRA_VERSION, g_port);
        fflush(stdout);
    }

    g_mutex = CreateMutexA(NULL, TRUE, MUTEX_NAME);
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        if (want_stop) {
            HWND other = FindWindowA("KydraTray", "Kydra");
            if (other) PostMessageA(other, WM_COMMAND, ID_TRAY_QUIT, 0);
            Sleep(400);
            return 0;
        }
        /* Já existe um Kydra: só traz a interface. */
        open_browser();
        return 0;
    }

    CreateThread(NULL, 0, server_thread, NULL, 0, NULL);
    if (open) open_browser();
    run_ui();

    if (g_mutex) CloseHandle(g_mutex);
    return 0;
}
