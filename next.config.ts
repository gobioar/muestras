// next.config.ts
import type { NextConfig } from "next"
import path from "node:path"

const LOADER = path.resolve(
  __dirname,
  "src/visual-edits/component-tagger-loader.js"
)

const isDev = process.env.NODE_ENV !== "production"

const nextConfig: NextConfig = {
  // Genera build auto-contenible para `next start` en Hostinger
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },

  // Mantiene el loader de Orchids solo en dev
  ...(isDev
    ? {
        turbopack: {
          rules: {
            "*.{jsx,tsx}": {
              loaders: [LOADER],
            },
          },
        },
      }
    : {}),
}

export default nextConfig
