module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["src/obsidian.d.ts"],
  rules: {
    "@typescript-eslint/no-unused-vars": [2, { args: "all", argsIgnorePattern: "^_" }],
  },
};
