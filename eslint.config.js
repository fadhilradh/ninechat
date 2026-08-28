import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist", ".netlify", "node_modules", "public/*.png"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    // shadcn primitives export their `cva` variants next to the component, and
    // a context provider has to export its hook. Both trip the fast-refresh
    // rule for no real benefit -- the rule earns its keep on app components.
    files: ["src/components/ui/**/*.tsx", "src/hooks/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Netlify functions export a `config` object alongside the handler, which
    // the react-refresh rule has no business policing.
    files: ["netlify/**/*.{ts,mts}"],
    rules: { "react-refresh/only-export-components": "off" },
  }
)
