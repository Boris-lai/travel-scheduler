// 第 N 天的日期 ＝ 出發日 ＋（N − 1）天。後端沒有存，前端自己算
// 編輯頁和分享頁都會用到，所以搬到這裡共用
export function dayDate(startDate: string | null, day: number) {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + day - 1);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
