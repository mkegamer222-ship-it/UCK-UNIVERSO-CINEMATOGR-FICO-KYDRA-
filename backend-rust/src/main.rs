//! kydra-backend — backend de referência do Kydra Launcher.
//!
//! Serve a interface (raiz do repositório) e a API descrita em `docs/API.md`:
//!   GET  /api/health
//!   GET  /api/versions
//!   POST /api/install | /api/prepare | /api/play
//!
//! Só biblioteca padrão: um servidor HTTP curto, previsível e sem árvore de
//! dependências. Onde o Node lê `src/js/data/builds.js`, aqui o catálogo é
//! embutido em JSON (`CATALOG`) — é o único ponto que precisa ser mantido em
//! par com o arquivo da interface.
//!
//! Rodar:  cargo run --release        (porta 8787, ou $PORT)
//!
//! Estado atual: contrato e estrutura. As ações devolvem `202 queued` — o
//! trabalho real (baixar a release, rodar o prepare, dar spawn no cliente) é o
//! próximo passo e vai reaproveitar os crates do Horizon.

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};

const DEFAULT_PORT: u16 = 8787;

/// Catálogo embutido. Mantenha em par com `src/js/data/builds.js`
/// (`npm run check` avisa quando os tamanhos divergem).
const CATALOG: &str = include_str!("../../src/js/data/builds.json");

fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let root = std::env::var("KYDRA_ROOT").unwrap_or_else(|_| ".".to_string());
    let root = PathBuf::from(root)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from("."));

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr).unwrap_or_else(|e| {
        eprintln!("não consegui abrir {addr}: {e}");
        std::process::exit(1);
    });
    println!("Kydra Launcher (Rust) → http://{addr}");

    for stream in listener.incoming().flatten() {
        let root = root.clone();
        std::thread::spawn(move || {
            if let Err(e) = handle(stream, &root) {
                eprintln!("conexão encerrada: {e}");
            }
        });
    }
}

fn handle(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut request_line = String::new();
    if reader.read_line(&mut request_line)? == 0 {
        return Ok(());
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_string();
    let target = parts.next().unwrap_or("/").to_string();

    // Consome os cabeçalhos (não usamos nenhum deles além do Content-Length).
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 || line == "\r\n" {
            break;
        }
        if let Some(v) = line.to_ascii_lowercase().strip_prefix("content-length:") {
            content_length = v.trim().parse().unwrap_or(0);
        }
    }
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body)?;
    }

    let path = target.split('?').next().unwrap_or("/");

    if let Some(route) = path.strip_prefix("/api/") {
        let (status, payload) = api(route, &method, &body);
        return respond(&mut stream, status, "application/json; charset=utf-8", payload.as_bytes());
    }

    serve_static(&mut stream, root, path)
}

/// Respostas da API. O contrato vive em `docs/API.md`.
fn api(route: &str, method: &str, body: &[u8]) -> (u16, String) {
    match (route, method) {
        ("health", "GET") => (
            200,
            r#"{"ok":true,"mode":"backend","launcher":"kydra/0.1.0","runtime":"rust"}"#.to_string(),
        ),
        ("versions", "GET") => (200, format!(r#"{{"versions":{}}}"#, CATALOG)),
        ("install" | "prepare" | "play", "POST") => {
            let received = String::from_utf8_lossy(body);
            let id = field(&received, "id")
                .or_else(|| field(&received, "buildId"))
                .unwrap_or_else(|| "unknown".into());
            let job = route;
            let payload = format!(
                r#"{{"ok":true,"queued":"{}","id":"{}","note":"stub: o backend de produto baixa, prepara e dá spawn no horizon-client"}}"#,
                job, id
            );
            (202, payload)
        }
        _ => (404, r#"{"error":"rota inexistente"}"#.to_string()),
    }
}

/// Extrai um campo string de um JSON raso sem trazer um parser inteiro.
fn field(json: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    let start = json.find(&needle)? + needle.len();
    let rest = &json[start..];
    let colon = rest.find(':')? + 1;
    let rest = rest[colon..].trim_start();
    let rest = rest.strip_prefix('"')?;
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn serve_static(stream: &mut TcpStream, root: &Path, path: &str) -> std::io::Result<()> {
    let rel = if path == "/" { "/index.html" } else { path };
    let rel = url_decode(rel);

    // Nunca sai da raiz do projeto.
    let candidate = root.join(rel.trim_start_matches('/'));
    let canonical = match candidate.canonicalize() {
        Ok(p) => p,
        Err(_) => return respond(stream, 404, "text/plain; charset=utf-8", b"404 — nao encontrado"),
    };
    if !canonical.starts_with(root) || !canonical.is_file() {
        return respond(stream, 404, "text/plain; charset=utf-8", b"404 — nao encontrado");
    }

    let mime = match canonical.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "md" => "text/markdown; charset=utf-8",
        _ => "application/octet-stream",
    };

    match fs::read(&canonical) {
        Ok(data) => respond(stream, 200, mime, &data),
        Err(_) => respond(stream, 404, "text/plain; charset=utf-8", b"404 — nao encontrado"),
    }
}

fn respond(stream: &mut TcpStream, status: u16, mime: &str, body: &[u8]) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        202 => "Accepted",
        403 => "Forbidden",
        404 => "Not Found",
        _ => "OK",
    };
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\n\
         content-type: {mime}\r\n\
         content-length: {}\r\n\
         cache-control: no-cache\r\n\
         x-content-type-options: nosniff\r\n\
         connection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()
}

fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
            if let Ok(v) = u8::from_str_radix(hex, 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}
