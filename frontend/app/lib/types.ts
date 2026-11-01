// 後端 DestinationOut 的樣子（先列出畫面會用到的欄位）
export type Destination = {
  id: number;
  place_name: string;
  city_name: string | null;
  description: string | null;
  geo_tags: string | null;
};

// 後端 POST /api/search 回傳的樣子（schemas/search.py 的 SearchOut）
export type SearchResponse = {
  location: string;
  status: "completed" | "processing";
  task_id: string | null;
  destinations: Destination[];
};
