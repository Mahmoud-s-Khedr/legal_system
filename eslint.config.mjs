import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "alert",
          message: "Use showErrorDialog from src/lib/dialog.ts instead."
        },
        {
          name: "confirm",
          message: "Use confirmAction from src/lib/dialog.ts instead."
        }
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "alert",
          message: "Use showErrorDialog from src/lib/dialog.ts instead."
        },
        {
          object: "window",
          property: "confirm",
          message: "Use confirmAction from src/lib/dialog.ts instead."
        }
      ]
    }
  }
);
