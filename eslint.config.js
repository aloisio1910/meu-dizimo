// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions rodam no Deno, com outro tipo de import (npm:).
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
