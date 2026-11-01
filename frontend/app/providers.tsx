"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

// 把 TanStack Query 的快取（QueryClient）提供給整個網站
export default function Providers({ children }: { children: React.ReactNode }) {
  // 用 useState 建立：畫面重畫時才不會又建一個新的，把快取弄丟
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}
