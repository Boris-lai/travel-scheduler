"use client";

// 熱門城市：都是資料庫裡已經有景點的城市，點了馬上有結果。從北到南排，像一條縱貫線
const CITIES = ["札幌", "名古屋", "京都", "大阪", "廣島", "福岡"];
const LINE = "#E5302F"; // 第 1 號線的紅色
const DRAW_SECONDS = 1.4; // 路線從頭畫到尾要幾秒

type Props = {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSearch: (location: string) => void;
  searching: boolean;
};

// 首頁最上面：大標題、搜尋框、一條會自己畫出來的路線（熱門城市是線上的車站）
export default function HomeHero({
  keyword,
  onKeywordChange,
  onSearch,
  searching,
}: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // 表單送出時，瀏覽器預設會重新整理頁面，把它擋掉
    onSearch(keyword.trim());
  }

  function pickCity(city: string) {
    onKeywordChange(city); // 輸入框也填上這個城市
    onSearch(city);
  }

  // 第一站、最後一站的圓心，離左右兩邊多遠：每一站佔 1/6 寬，圓心在正中間
  const edge = `${50 / CITIES.length}%`;

  return (
    <section className="py-10 sm:py-16">
      <h1 className="text-4xl leading-tight font-black sm:text-6xl">
        想去哪裡？
      </h1>
      <p className="mt-3 max-w-xl text-ink-2">
        輸入城市，AI 幫你找景點；再把每一天排成一條路線。
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex max-w-2xl gap-2">
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="例如：京都"
          aria-label="想去的城市"
          className="min-w-0 flex-1 rounded-md border-2 border-ink bg-board px-4 py-3 text-xl font-bold placeholder:font-normal placeholder:text-ink-2"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-md bg-ink px-6 py-3 text-lg font-bold text-white hover:bg-ink/85 disabled:opacity-50"
        >
          {searching ? "搜尋中…" : "搜尋"}
        </button>
      </form>

      <div className="mt-12">
        <p className="mb-4 text-sm text-ink-2">或是從這條路線上挑一站：</p>
        <div className="relative">
          {/* 路線：從第一站的圓心，畫到最後一站的圓心 */}
          <div
            className="absolute top-[10px] h-2"
            style={{ left: edge, right: edge }}
            aria-hidden="true"
          >
            <svg
              className="block h-full w-full"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="4"
                x2="100"
                y2="4"
                stroke={LINE}
                strokeWidth="8"
                pathLength="1"
                className="route-draw"
                style={{ animationDuration: `${DRAW_SECONDS}s` }}
              />
            </svg>
          </div>

          {/* 車站：線畫到哪一站，那一站就冒出來 */}
          <ol className="relative flex">
            {CITIES.map((city, i) => (
              <li key={city} className="flex-1">
                <button
                  type="button"
                  onClick={() => pickCity(city)}
                  disabled={searching}
                  className="group flex w-full flex-col items-center gap-2"
                >
                  <span
                    className="station-in h-7 w-7 rounded-full border-[6px] border-[#E5302F] bg-board group-hover:bg-[#E5302F]"
                    style={{
                      animationDelay: `${(DRAW_SECONDS * i) / (CITIES.length - 1)}s`,
                    }}
                  />
                  <span className="text-sm font-bold group-hover:underline sm:text-lg">
                    {city}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
