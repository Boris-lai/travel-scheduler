// 每一天一個路線色，像捷運一樣：第 1 天紅線、第 2 天藍線……超過 5 天就從頭輪
const LINE_COLORS = ["#E5302F", "#0072BC", "#009B4E", "#F08300", "#8E4F9E"];

export function lineColor(day: number) {
  return LINE_COLORS[(day - 1) % LINE_COLORS.length];
}

// (day - 1) % LINE_COLORS.length：% 是除完的餘數。第 6 天是 5 % 5 = 0，又回到第一個顏色。
