import { fileURLToPath } from "node:url";

// Resolve the Tailwind config relative to this file, so it works from any working directory.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL("./tailwind.config.ts", import.meta.url)) },
    autoprefixer: {},
  },
};
