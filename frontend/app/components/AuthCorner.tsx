"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { logout } from "@/app/lib/api";
import { useMe } from "@/app/lib/useMe";

// 導覽列右邊：沒登入顯示「登入／註冊」，登入了顯示名字和「登出」
export default function AuthCorner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useMe();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // 小白板上的資料可能是上一個人的（例如他的行程）：全部清回空白，畫面上正在用的會重新抓
      queryClient.resetQueries();
      router.push("/");
    },
  });

  // 還不知道有沒有登入：先什麼都不顯示，免得「登入」閃一下又變成名字
  if (isPending) return null;

  if (!me) {
    return (
      <Link href="/login" className="hover:text-blue-600">
        登入／註冊
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-normal text-gray-500">哈囉，{me.name}</span>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        登出
      </button>
    </div>
  );
}
