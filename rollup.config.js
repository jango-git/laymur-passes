import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "esm",
    sourcemap: true,
  },
  plugins: [
    nodeResolve({ extensions: [".js", ".ts"] }),
    typescript({
      tsconfig: "tsconfig.json",
      useTsconfigDeclarationDir: true,
    }),
    terser({
      compress: {
        arrows: true,
        arguments: true,
        booleans_as_integers: true,
        dead_code: true,
        drop_console: true,
        drop_debugger: true,
        ecma: 2020,
        keep_fargs: false,
        passes: 3,
        toplevel: true,
        pure_getters: true,
        unsafe: true,
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      format: {
        comments: false,
        ecma: 2020,
      },
      mangle: {
        properties: {
          regex: /^_/,
        },
      },
    }),
  ],
  external: ["three"],
};
