// prettier.config.js, .prettierrc.js, prettier.config.mjs, or .prettierrc.mjs

/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 80,
  tabWidth: 4,
  useTabs: false,
  singleQuote: true,
  bracketSpacing: true,
  trailingComma: "all", //es5
  semi: true,
  arrowParens: "always",
  endOfLine: "lf",

  quoteProps: "as-needed",
  objectWrap: "preserve",

  // parser: 'typescript',
  experimentalTernaries: true,
  experimentalOperatorPosition: "start",

  bracketSameLine: false,
  singleAttributePerLine: false,
  embeddedLanguageFormatting: "auto",
  requirePragma: false,
  insertPragma: false,
  checkIgnorePragma: true,
  proseWrap: "preserve", //md
};

export default config;
