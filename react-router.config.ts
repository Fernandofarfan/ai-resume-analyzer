import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode — the app uses IndexedDB/localStorage, no server needed
  ssr: false,
} satisfies Config;
