// Minimal static server. It exists only because getUserMedia refuses to run on
// file:// — browsers require a secure context, and http://localhost counts as
// one. No dependencies, so there is nothing to install.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", `http://localhost:${port}`);
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);

  // Keep the served tree inside this directory.
  const file = join(root, normalize(requested).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`meet-prejoin  →  http://localhost:${port}`);
});
