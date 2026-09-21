import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT ?? 3001);
// @ts-ignore
const DIR = import.meta.dir;
const HTML_PATH = join(DIR, "index.html");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
};

// Allowlist: only image files that exist next to the server can be inlined.
const allowedImages = new Set(
  readdirSync(DIR).filter((f) => {
    const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
    return f !== "colores.jpeg" && MIME[ext] !== undefined;
  })
);

function getPage(): string {
  const html = readFileSync(HTML_PATH, "utf8");
  return html.replace(/\{\{IMG:([^}]+)\}\}/g, (_, name: string) => {
    if (!allowedImages.has(name)) {
      throw new Error(`Image not found or not allowed: ${name}`);
    }
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    const data = readFileSync(join(DIR, name));
    return `data:${MIME[ext]};base64,${data.toString("base64")}`;
  });
}

const etag = () => `"${Bun.hash(getPage()).toString(36)}"`;

Bun.serve({
  port: PORT,
  fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname.startsWith("/public/")) {
      const rel = decodeURIComponent(pathname.slice("/public/".length));
      if (rel.includes("..")) return new Response("No encontrado", { status: 404 });
      return new Response(Bun.file(join(DIR, "public", rel)), { headers: { "Cache-Control": "no-cache" } });
    }

    if (pathname !== "/") {
      return new Response("No encontrado", { status: 404 });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Método no permitido", { status: 405 });
    }

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      ETag: etag(),
    };
    if (req.headers.get("if-none-match") === headers.ETag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(req.method === "HEAD" ? null : getPage(), { status: 200, headers });
  },
});

console.log(`DOLCE CAPRIXO sirviendo en http://localhost:${PORT}`);
