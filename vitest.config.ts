import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  // FormBase assigns nested forms in its constructor; with define semantics, uninitialized
  // field declarations in subclasses (e.g. `child!: Child`) would reset them to undefined.
  // These two options match `tsc` with `useDefineForClassFields: false`.
  oxc: {
    assumptions: { setPublicClassFields: true },
    typescript: { removeClassFieldsWithoutInitializer: true },
  },
})
