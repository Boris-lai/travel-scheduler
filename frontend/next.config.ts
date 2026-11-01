import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSE 經過轉送時，壓縮會讓訊息被存起來、最後才一次送出，所以關掉
  compress: false,
  // 瀏覽器打 /api/... 到前端（3000），由前端轉給後端（8000）
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
