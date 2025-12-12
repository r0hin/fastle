import esbuild from "esbuild";

esbuild
  .build({
    entryPoints: ["extension.ts"],
    bundle: true,
    outfile: "dist/bundle.js",
    platform: "browser", // Ensures output is browser-friendly
    format: "iife", // Immediately Invoked Function Expression to avoid polluting global scope
    target: ["es2015"], // Adjust based on your needs or desired ES level
  })
  .catch(() => process.exit(1));
