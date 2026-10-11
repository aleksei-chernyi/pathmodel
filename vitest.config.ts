import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  // The components import the library by its package name (in an app, the compiled `dist/`).
  // In this repo, that name resolves to the source under test.
  resolve: {
    alias: [
      {
        find: /^@aleksei-chernyi\/pathmodel$/,
        replacement: new URL("./src/index.ts", import.meta.url).pathname,
      },
    ],
  },
  // FormBase assigns nested forms in its constructor; with define semantics, uninitialized
  // field declarations in subclasses (e.g. `child!: Child`) would reset them to undefined.
  // These two options match `tsc` with `useDefineForClassFields: false`.
  oxc: {
    assumptions: { setPublicClassFields: true },
    typescript: { removeClassFieldsWithoutInitializer: true },
  },
})
