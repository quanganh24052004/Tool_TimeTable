/** Ngày bắt đầu (Thứ 2) của tuần số 1: 11/01/2027 */
export const WEEK_1_START = new Date(2027, 0, 11);

export function dayOf(week: number, thu: number): Date {
  const d = new Date(WEEK_1_START);
  d.setDate(d.getDate() + (week - 1) * 7 + (thu - 2)); // thu: 2..8 (8 = CN)
  return d;
}

const dm = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
export const fmtDM = dm;
export const fmtDMY = (d: Date) => `${dm(d)}/${d.getFullYear()}`;
export const weekRangeLabel = (w: number) => `${dm(dayOf(w, 2))} – ${dm(dayOf(w, 8))}`;
export const weekRangeFullLabel = (w: number) => `${fmtDMY(dayOf(w, 2))} – ${fmtDMY(dayOf(w, 8))}`;

/** Trả về khoảng ngày bắt đầu tuần nhỏ nhất đến kết thúc tuần lớn nhất của mảng tuần */
export function weeksSpanDateLabel(weeks: number[]): string {
  if (!weeks.length) return '';
  const minW = Math.min(...weeks);
  const maxW = Math.max(...weeks);
  return `${fmtDMY(dayOf(minW, 2))} – ${fmtDMY(dayOf(maxW, 8))}`;
}
