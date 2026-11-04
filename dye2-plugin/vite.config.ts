import { defineConfig } from "vite";
import { resolve } from "path";
import { mkdirSync, copyFileSync } from "fs";
import { execFileSync } from "child_process";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/plugin.ts"),
      name: "createPlugin",
      formats: ["iife"],
      fileName: () => "plugin.js",
    },
    outDir: resolve(__dirname, "../dye2.reaplugin"),
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      output: {
        // Wrap in a function that flutter_js can call
        // The IIFE should expose createPlugin on globalThis
        footer: "",
      },
    },
  },
  plugins: [
    {
      // Tailwind runs here, not as its own watcher: `tailwindcss --watch` exits as soon as
      // stdin closes, so a backgrounded one dies silently and `vite build --watch` then
      // bundles a stale tailwind.generated.css — a new arbitrary class (pb-[20px]) has no
      // rule until someone remembers to run the full build. Generating it before each
      // bundle keeps one watcher and no ordering to get wrong. ~200ms a rebuild.
      name: "tailwind-css",
      buildStart() {
        execFileSync("npm", ["run", "build:css"], { cwd: __dirname, stdio: "inherit" });
      },
    },
    {
      name: "copy-manifest",
      closeBundle() {
        const outDir = resolve(__dirname, "../dye2.reaplugin");
        mkdirSync(outDir, { recursive: true });
        // The source manifest is deliberately NOT named manifest.json: Decaid
        // resolves a branch-source plugin root by looking for directories that
        // contain a manifest.json, and refuses to install when it finds more
        // than one. Only the build output may carry that name.
        copyFileSync(
          resolve(__dirname, "manifest.src.json"),
          resolve(outDir, "manifest.json")
        );
      },
    },
  ],
});
