import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  async headers() {
    return [
      {
        // Manifest PWA: tipo MIME correcto y sin caché agresiva para que
        // Chrome siempre valide una web instalable actualizada.
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        // El service worker siempre debe revalidarse para detectar nuevas
        // versiones (junto a updateViaCache:'none' en el registro).
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Íconos PWA estáticos: caché corta (se re-validan por si el admin
        // cambia el logo y PwaIconSync regenera los íconos personalizados).
        source: "/android-chrome-192.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
      {
        source: "/android-chrome-512.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Evita que las librerías de mapas rompan la compilación del cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;