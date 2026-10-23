// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { apiDevMiddlewarePlugin } from "./src/server/devMiddleware.ts";

export default defineConfig({
  plugins: [apiDevMiddlewarePlugin()],
  vite: {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
  },
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server & client entries to src/server.ts and src/client.tsx
    // nitro/vite builds from this
    server: { entry: "server" },
    client: { entry: "client" },
  },
});
