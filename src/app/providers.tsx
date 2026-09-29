"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // 서버에서 받아 둔 데이터를 화면 진입 직후 곧바로 다시 부르지 않게 한다
      queries: { staleTime: 60 * 1000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// 서버에서는 요청마다 새로 만들고, 브라우저에서는 하나를 계속 쓴다.
// 렌더 중에 새로 만들면 React가 첫 렌더를 버릴 때 캐시가 함께 사라진다.
function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
