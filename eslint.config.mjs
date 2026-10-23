import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  globalIgnores([
    ".next/**",
    ".next-demo-dev/**",
    "out/**",
    "coverage/**",
    "public/jogo-cliente/**",
    "src/generated/**",
    "src/runtime/actions.ts",
    "src/runtime/readers.ts",
    "src/runtime/client.ts",
  ]),
]);
