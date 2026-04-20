import js from "@eslint/js";
import nodePlugin from "eslint-plugin-n";
import globals from "globals";

/**
 * @file eslint.config.mjs
 * @description ESLint 9 Flat Configuration for Compari Backend.
 * @responsibility Enforces code quality and Node.js best practices.
 * @separation_of_concerns Isolates linting rules from application logic.
 */
export default [
  js.configs.recommended,
  nodePlugin.configs["flat/recommended-script"],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_|next" }],
      "no-console": "off",
      "n/no-unsupported-features/es-syntax": "off",
      "n/no-unsupported-features/node-builtins": "off",
      "n/no-missing-require": "error",
      "no-process-exit": "off",
      "n/no-process-exit": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-empty": "warn",
    },
  },
];