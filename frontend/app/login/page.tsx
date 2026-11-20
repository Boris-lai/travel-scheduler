"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { claimAnonTrips, login, signup } from "@/app/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const isLogin = mode === "login";

  const submit = useMutation({
    mutationFn: () =>
      isLogin
        ? login({ email, password })
        : signup({ email, password, name: name.trim() }),
    onSuccess: async (user) => {
      // 後端已經用 cookie 發了手環。回來的會員資料直接放上小白板，導覽列馬上換成名字
      queryClient.setQueryData(["me"], user);
      // 沒登入時建立的行程，現在認領到帳號下（認領完，按鈕才會從「處理中…」變回來）
      await claimAnonTrips();
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["anonTrips"] });
      router.push("/trips");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit.mutate();
  }

  function switchMode() {
    setMode(isLogin ? "signup" : "login");
    submit.reset(); // 換模式時，清掉上一次的錯誤訊息
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-3xl font-bold">{isLogin ? "登入" : "註冊"}</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow"
      >
        {!isLogin && (
          <label className="flex flex-col gap-1 text-sm">
            名字
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {isLogin ? "密碼" : "密碼（至少 8 個字）"}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isLogin ? undefined : 8}
            maxLength={128}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        {submit.isError && (
          <p className="text-sm text-red-600">{submit.error.message}</p>
        )}

        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submit.isPending ? "處理中…" : isLogin ? "登入" : "註冊"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        {isLogin ? "還沒有帳號？" : "已經有帳號了？"}
        <button
          type="button"
          onClick={switchMode}
          className="text-blue-600 hover:underline"
        >
          {isLogin ? "註冊" : "登入"}
        </button>
      </p>
    </main>
  );
}
