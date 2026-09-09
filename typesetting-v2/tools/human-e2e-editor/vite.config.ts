import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [{
    name: "tatespun-v2-human-e2e-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const api = await server.ssrLoadModule("./exportServer.ts");
          if (req.url === "/preview") {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(await api.buildPreview(input)));
          } else if (req.url === "/export") {
            const bytes: Uint8Array = await api.buildPdf(input);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", "attachment; filename=tatespun-v2-human-e2e.pdf");
            res.end(Buffer.from(bytes));
          } else { res.statusCode = 404; res.end("Not found"); }
        } catch (error) {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.stack : String(error));
        }
      });
    },
  }],
  resolve: { alias: { "@": fileURLToPath(new URL("../../../src", import.meta.url)) } },
  ssr: { noExternal: ["opentype.js"] },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
