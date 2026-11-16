import * as XLSX from 'xlsx';
import type { ClassSession, CourseGroup, RawCourseRow, Section } from '../types/timetable';

export const PARSER_VERSION = 6;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Định dạng cột Tuần:
 *  - "x"             : học tuần x (VD: "8" -> [8])
 *  - "x-y"           : học từ tuần x tới tuần y (VD: "9-10" -> [9, 10], "1-10" -> [1..10])
 *  - "x-y, z-t, ..." : học từ tuần x tới y, sau đó từ z tới t (VD: "1-3, 6-8" -> [1,2,3,6,7,8])
 *  - Hỗ trợ cả trường hợp Excel tự động đổi "1-10" thành ngày ("10-Jan", "Jan-10", "01/10/2026")
 *    hoặc chuỗi kèm chữ ("Tuần 1-10", "T1-3; 5-8").
 */
export function parseWeeks(str: unknown): number[] {
  const out = new Set<number>();
  let s = String(str ?? '').trim();
  if (!s || s === '—' || s === '-' || s.toUpperCase() === 'NULL') return [];

  // 1. Khôi phục nếu Excel tự format "1-10" / "9-10" thành ngày kiểu "10-Jan", "Jan-10", "10-Thg1"
  const excelMonthDay1 = s.match(
    /^(\d{1,2})[-/\s]+(?:thg\s*(\d{1,2})|([a-zA-Z]{3,}))(?:[-/\s]+\d{2,4})?$/i
  );
  if (excelMonthDay1) {
    const d = +excelMonthDay1[1];
    const m = excelMonthDay1[2]
      ? +excelMonthDay1[2]
      : MONTHS[excelMonthDay1[3].slice(0, 3).toLowerCase()];
    if (m && d) s = `${Math.min(m, d)}-${Math.max(m, d)}`;
  }
  const excelMonthDay2 = s.match(
    /^(?:thg\s*(\d{1,2})|([a-zA-Z]{3,}))[-/\s]+(\d{1,2})(?:[-/\s]+\d{2,4})?$/i
  );
  if (excelMonthDay2) {
    const m = excelMonthDay2[1]
      ? +excelMonthDay2[1]
      : MONTHS[excelMonthDay2[2].slice(0, 3).toLowerCase()];
    const d = +excelMonthDay2[3];
    if (m && d) s = `${Math.min(m, d)}-${Math.max(m, d)}`;
  }
  // Khôi phục nếu Excel tự format thành ngày kiểu "1/10/2026" hoặc "2026-09-10"
  const excelSlashDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (excelSlashDate) {
    const a = +excelSlashDate[1];
    const b = +excelSlashDate[2];
    if (a >= 1 && b >= 1 && a <= 31 && b <= 31) {
      s = `${Math.min(a, b)}-${Math.max(a, b)}`;
    }
  }
  const isoDate = s.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    const a = +isoDate[1];
    const b = +isoDate[2];
    if (a >= 1 && b >= 1 && a <= 31 && b <= 31) {
      s = `${Math.min(a, b)}-${Math.max(a, b)}`;
    }
  }

  // 2. Trường hợp chuỗi bitmap tuần dạng "123456----" (có từ 2 dấu '-' liên tiếp trở lên)
  if (/^[0-9\-_]{5,}$/.test(s) && s.includes('--')) {
    for (let i = 0; i < s.length; i++) {
      if (/\d/.test(s[i])) out.add(i + 1);
    }
    return [...out].sort((a, b) => a - b);
  }

  // 3. Chuẩn hóa mọi dấu gạch nối khoảng ("–", "—", "−", "~", "→", "->", "đến", "to") về "-"
  const normalized = s
    .toLowerCase()
    .replace(/\b(đến|den|to)\b/g, '-')
    .replace(/[–—−‐‑‒―－~→]+|->|\.\.+/g, '-');

  // 4. Bắt tất cả cụm "x-y" hoặc "x"
  for (const match of normalized.matchAll(/(\d+)\s*-\s*(\d+)|(\d+)/g)) {
    if (match[1] !== undefined && match[2] !== undefined) {
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      if (start >= 1 && end <= 52) {
        for (let w = start; w <= end; w++) out.add(w);
      }
    } else if (match[3] !== undefined) {
      const w = parseInt(match[3], 10);
      if (w >= 1 && w <= 52) out.add(w);
    }
  }

  return [...out].sort((a, b) => a - b);
}

/**
 * Định dạng mảng tuần thành chuỗi chuẩn:
 *  - [8] -> "8"
 *  - [9, 10] -> "9-10"
 *  - [1,2,3,6,7,8,12] -> "1-3, 6-8, 12"
 */
export function formatWeeks(w: number[], fallbackRaw?: string): string {
  const sorted = [...new Set(w ?? [])]
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 52)
    .sort((a, b) => a - b);

  if (!sorted.length) {
    if (fallbackRaw && fallbackRaw.trim() && fallbackRaw.trim() !== '—' && fallbackRaw.trim() !== '-') {
      const reparsed = parseWeeks(fallbackRaw);
      if (reparsed.length) return formatWeeks(reparsed);
      return fallbackRaw.trim();
    }
    return '—';
  }

  const parts: string[] = [];
  let a = sorted[0];
  let b = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === b + 1) {
      b = sorted[i];
      continue;
    }
    parts.push(a === b ? `${a}` : `${a}-${b}`);
    a = b = sorted[i];
  }
  return parts.join(', ');
}

/** Rút gọn tên phòng bị lặp dạng "509.H1 (509.H1)" -> "509.H1" */
export function cleanRoom(phong: string): string {
  return String(phong ?? '')
    .replace(/([^\s(),]+)\s*\(\1\)/g, '$1')
    .trim();
}

export function parseDay(v: string): number {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.startsWith('chủ') || s.startsWith('chu') || s === 'cn' || s === '1') return 8;
  const n = parseInt(s, 10);
  return n >= 2 && n <= 8 ? n : 0;
}

/** "1325" | "725" | "13:25" -> minutes since midnight */
export function parseHHMM(v: string): number {
  const digits = String(v ?? '').replace(/\D/g, '').padStart(4, '0');
  if (digits.length < 4) return 0;
  return parseInt(digits.slice(0, 2), 10) * 60 + parseInt(digits.slice(2, 4), 10);
}

/** Convert minutes into a "tiết" index (HUCE: tiết 1 starts at 6:45, 50 minutes each - approximate). */
export function minutesToTiet(min: number): number {
  return Math.max(1, Math.floor((min - 6 * 60 - 45) / 50) + 1);
}

const norm = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const ALIASES: Record<string, keyof RawCourseRow> = {
  ky: 'Ky',
  truong_vien_khoa: 'Truong_Vien_Khoa',
  ma_lop: 'Ma_lop',
  ma_lop_kem: 'Ma_lop_kem',
  ma_hp: 'Ma_HP',
  ten_hp: 'Ten_HP',
  ten_hp_tieng_anh: 'Tieu_HP_Tieng_Anh',
  khoi_luong: 'Khoi_luong',
  ghi_chu: 'Ghi_chu',
  buoi_so: 'Buoi_so',
  thu: 'Thu',
  thoi_gian: 'Thoi_gian',
  bd: 'BD',
  kt: 'KT',
  kip: 'Kip',
  tuan: 'Tuan',
  tuan_hoc: 'Tuan',
  ds_tuan: 'Tuan',
  tu_n: 'Tuan',
  tua_n: 'Tuan',
  week: 'Tuan',
  weeks: 'Tuan',
  phong: 'Phong',
  phong_hoc: 'Phong',
  trang_thai: 'Trang_thai',
  loai_lop: 'Loai_lop',
};

function mapHeaderKey(h: unknown): keyof RawCourseRow | undefined {
  const k = norm(String(h ?? ''));
  if (!k) return undefined;
  if (ALIASES[k]) return ALIASES[k];
  // Tránh nhận nhầm cột "Số tuần" / "Tổng tuần" thành cột "Tuần"
  if ((k.includes('tuan') && !k.includes('so_tuan') && !k.includes('tong')) || k === 'tu_n' || k === 'tua_n' || k.includes('week')) {
    return 'Tuan';
  }
  if (k.startsWith('ma_hp') || k === 'mahp' || k === 'mc_hp') return 'Ma_HP';
  if (k === 'ten_hp' || k === 'tenhp' || k === 'ta_n_hp' || k === 'tc_n_hp') return 'Ten_HP';
  if (k === 'ma_lop' || k === 'malop' || k === 'ma_l_p' || k === 'ma_la_p') return 'Ma_lop';
  if (k.startsWith('buoi') || k.startsWith('bua_i')) return 'Buoi_so';
  if (k.startsWith('thu') || k === 'th' || k === 'tha') return 'Thu';
  if (k.startsWith('thoi_gian') || k === 'thoigian' || k === 'tha_i_gian') return 'Thoi_gian';
  if (k.startsWith('phong') || k === 'pha_ng') return 'Phong';
  if (k.startsWith('ghi_chu') || k === 'ghichu' || k === 'ghi_cha') return 'Ghi_chu';
  return undefined;
}

/** Kiểm tra xem chuỗi có phải dạng tuần học hợp lệ (VD: "1", "9-10", "1-3, 6-8", "Tuần 1-10", "10-Jan") hay không */
function looksLikeWeekCell(val: string): boolean {
  const v = val.trim();
  if (!v || v.length > 40) return false;
  // Loại trừ giờ học 4 chữ số kiểu "0630", "1510", "0630-0910", mã lớp/HP 6 chữ số
  if (/^\d{4,}(-\d{4,})?$/.test(v)) return false;
  if (/^\d{1,2}:\d{2}/.test(v)) return false;
  const w = parseWeeks(v);
  return w.length > 0 && w.every((n) => n >= 1 && n <= 35);
}

function rowsFromMatrix(matrix: unknown[][]): RawCourseRow[] {
  let hIdx = matrix.findIndex((r) => r.some((c) => mapHeaderKey(c) === 'Ma_HP'));
  if (hIdx < 0) hIdx = 0;
  const headers = (matrix[hIdx] || []).map(mapHeaderKey);

  // Tự động phát hiện cột Tuần dựa trên dữ liệu thực tế nếu header bị lỗi hoặc cột Tuần trống
  let detectedTuanCol = headers.indexOf('Tuan');
  const sampleLimit = Math.min(matrix.length, hIdx + 80);
  const checkColHasWeeks = (col: number) => {
    if (col < 0) return 0;
    let hits = 0;
    for (let i = hIdx + 1; i < sampleLimit; i++) {
      const cell = String(matrix[i]?.[col] ?? '').trim();
      if (looksLikeWeekCell(cell)) hits++;
    }
    return hits;
  };

  if (checkColHasWeeks(detectedTuanCol) < 3) {
    const excludedKeys = new Set<keyof RawCourseRow>([
      'Ky',
      'Ma_lop',
      'Ma_lop_kem',
      'Ma_HP',
      'Khoi_luong',
      'Buoi_so',
      'Thu',
      'Thoi_gian',
      'BD',
      'KT',
      'Phong',
    ]);
    const maxCols = Math.max(...matrix.slice(hIdx, sampleLimit).map((r) => r?.length ?? 0), 0);
    let bestCol = -1;
    let bestScore = 0;
    for (let col = 0; col < maxCols; col++) {
      const mapped = headers[col];
      if (mapped && excludedKeys.has(mapped)) continue;
      // Ưu tiên cột có chứa dấu gạch ngang khoảng tuần "x-y" (như "1-10", "9-10", "13-22")
      let rangeHits = 0;
      let totalHits = 0;
      for (let i = hIdx + 1; i < sampleLimit; i++) {
        const cell = String(matrix[i]?.[col] ?? '').trim();
        if (looksLikeWeekCell(cell)) {
          totalHits++;
          if (cell.includes('-') || cell.includes('–')) rangeHits++;
        }
      }
      const score = rangeHits * 3 + totalHits;
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    if (bestCol >= 0) detectedTuanCol = bestCol;
  }

  const kipIdx = headers.indexOf('Kip');
  const phongIdx = headers.indexOf('Phong');

  const rows: RawCourseRow[] = [];
  for (let i = hIdx + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every((c) => c === '' || c == null)) continue;
    const obj: Record<string, string> = {};
    headers.forEach((key, idx) => {
      if (!key) return;
      const val = String(r[idx] ?? '').trim();
      // Giữ giá trị đầu tiên hợp lệ của mỗi trường, không để cột trống/thừa phía sau ghi đè
      if (!obj[key] && val) obj[key] = val;
    });

    // Đảm bảo lấy đúng cột Tuần đã phát hiện
    if ((!obj.Tuan || parseWeeks(obj.Tuan).length === 0) && detectedTuanCol >= 0) {
      const candidate = String(r[detectedTuanCol] ?? '').trim();
      if (parseWeeks(candidate).length > 0) obj.Tuan = candidate;
    }

    // Dự phòng lấy cột ngay sau Kíp hoặc ngay trước Phòng (cấu trúc chuẩn file TKB HUCE: ... | Kíp (14) | Tuần (15) | Phòng (16))
    if (!obj.Tuan || parseWeeks(obj.Tuan).length === 0) {
      const fallbackIndices = [
        kipIdx >= 0 ? kipIdx + 1 : -1,
        phongIdx > 0 ? phongIdx - 1 : -1,
        15,
      ];
      for (const idx of fallbackIndices) {
        if (idx >= 0 && r[idx] != null) {
          const candidate = String(r[idx]).trim();
          if (looksLikeWeekCell(candidate)) {
            obj.Tuan = candidate;
            break;
          }
        }
      }
    }

    if (obj.Ma_HP && obj.Thu) rows.push(obj as unknown as RawCourseRow);
  }
  if (rows.length > 0 && rows.every((x) => !x.Tuan || parseWeeks(x.Tuan).length === 0)) {
    console.warn('[HUCE TKB] Toàn bộ dòng thiếu Tuần. Header gốc:', matrix[hIdx], 'Dòng đầu:', matrix[hIdx + 1]);
  }
  return rows;
}

function splitCSVLine(line: string, d: string): string[] {
  const res: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (c === d && !q) {
      res.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  res.push(cur);
  return res;
}

export function parseCSVText(text: string): RawCourseRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const d = lines[0].includes('\t')
    ? '\t'
    : lines[0].split(';').length > lines[0].split(',').length
    ? ';'
    : ',';
  return rowsFromMatrix(lines.map((l) => splitCSVLine(l, d)));
}

export async function parseArrayBuffer(buf: ArrayBuffer): Promise<RawCourseRow[]> {
  const wb = XLSX.read(buf, { type: 'array' });
  let best: RawCourseRow[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
    });
    // Nếu có ô bị rỗng do format text ẩn trong Excel nhưng vẫn có giá trị thô (raw: true), bổ sung lại
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: '',
    });
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      const rRow = rawMatrix[r];
      if (!row || !rRow) continue;
      for (let c = 0; c < rRow.length; c++) {
        if ((row[c] === '' || row[c] == null) && rRow[c] !== '' && rRow[c] != null) {
          row[c] = String(rRow[c]);
        }
      }
    }
    // Giải gộp ô (Merged Cells theo chiều dọc) để các dòng con nhận lại đúng giá trị Tuần / Mã HP
    if (Array.isArray(ws['!merges'])) {
      for (const m of ws['!merges']) {
        if (m.s.c === m.e.c && m.e.r > m.s.r) {
          const topVal = matrix[m.s.r]?.[m.s.c];
          if (topVal !== '' && topVal != null) {
            for (let r = m.s.r + 1; r <= m.e.r; r++) {
              if (matrix[r] && (matrix[r][m.s.c] === '' || matrix[r][m.s.c] == null)) {
                matrix[r][m.s.c] = topVal;
              }
            }
          }
        }
      }
    }
    const rows = rowsFromMatrix(matrix);
    if (rows.length > best.length) best = rows;
  }
  return best;
}

export async function parseFile(file: File): Promise<RawCourseRow[]> {
  if (/\.(csv|txt)$/i.test(file.name)) return parseCSVText(await file.text());
  return parseArrayBuffer(await file.arrayBuffer());
}

export function buildCourseGroups(rows: RawCourseRow[]): CourseGroup[] {
  const groups = new Map<string, CourseGroup>();
  const sectionMap = new Map<string, Section>();
  for (const r of rows) {
    const thu = parseDay(r.Thu);
    if (!thu) continue;
    let bd = r.BD;
    let kt = r.KT;
    if ((!bd || !kt) && r.Thoi_gian) [bd, kt] = r.Thoi_gian.split('-');
    const s = parseHHMM(bd);
    const e = parseHHMM(kt);
    if (!s || !e || e <= s) continue;

    // Đọc trường Tuần (chấp nhận cả key có dấu 'Tuần' nếu object truyền vào từ dữ liệu thô khác)
    const rawAny = r as unknown as Record<string, unknown>;
    const tuanRaw = String(r.Tuan ?? rawAny['Tuần'] ?? rawAny['tuan'] ?? '').trim();
    const tuanHoc = parseWeeks(tuanRaw);
    const buoiSo = parseInt(String(r.Buoi_so ?? rawAny['Buổi_số'] ?? '1'), 10) || 1;

    const session: ClassSession = {
      buoiSo,
      thu,
      timeStartMinutes: s,
      timeEndMinutes: e,
      tietStart: minutesToTiet(s),
      tietEnd: minutesToTiet(e - 1),
      tuanHoc,
      tuanRaw,
      phong: cleanRoom(String(r.Phong ?? rawAny['Phòng'] ?? '')),
      ghiChu: String(r.Ghi_chu ?? rawAny['Ghi_chú'] ?? '').trim(),
    };

    const maHP = String(r.Ma_HP ?? rawAny['Mã_HP'] ?? '').trim();
    const maLop = String(r.Ma_lop ?? rawAny['Mã_lớp'] ?? '').trim();
    const tenHP = String(r.Ten_HP ?? rawAny['Tên_HP'] ?? '').trim();
    if (!maHP || !maLop) continue;

    let g = groups.get(maHP);
    if (!g) {
      g = { maHP, tenHP, sections: [] };
      groups.set(maHP, g);
    }

    const key = `${maHP}|${maLop}`;
    let sec = sectionMap.get(key);
    if (!sec) {
      sec = { id: maLop, maHP, tenHP: g.tenHP, sessions: [] };
      sectionMap.set(key, sec);
      g.sections.push(sec);
    }

    const dupKey = `${thu}|${s}|${e}|${tuanHoc.join(',')}|${session.phong}`;
    if (
      sec.sessions.some(
        (x) =>
          `${x.thu}|${x.timeStartMinutes}|${x.timeEndMinutes}|${x.tuanHoc.join(',')}|${x.phong}` ===
          dupKey
      )
    ) {
      continue;
    }
    sec.sessions.push(session);
  }
  return [...groups.values()].sort((a, b) => a.maHP.localeCompare(b.maHP));
}

export const SAMPLE_CSV = `Ky,Truong_Vien_Khoa,Ma_lop,Ma_lop_kem,Ma_HP,Ten_HP,Khoi_luong,Ghi_chu,Buoi_so,Thu,Thoi_gian,BD,KT,Kip,Tuan,Phong
20261,CNTT,020201,020201,070101,Lập trình Web,3,68IT1 - GV Nguyễn Văn A,1,2,0725-1105,0725,1105,Sáng,1-8,401.H2
20261,CNTT,020202,020202,070101,Lập trình Web,3,68IT2 - GV Nguyễn Văn A,1,4,0725-1105,0725,1105,Sáng,1-8,402.H2
20261,CNTT,020203,020203,070101,Lập trình Web,3,68IT3 - GV Trần Thị B,1,3,1325-1610,1325,1610,Chiều,1-8,403.H2
20261,CNTT,020301,020301,070102,Cơ sở dữ liệu,3,68IT1 - GV Lê Văn C,1,2,0725-1105,0725,1105,Sáng,9-16,501.H1
20261,CNTT,020302,020302,070102,Cơ sở dữ liệu,3,68IT2 - GV Lê Văn C,1,5,1325-1610,1325,1610,Chiều,9-16,502.H1
20261,Toán,030101,030101,080101,Xác suất thống kê,3,68XD1 - GV Phạm Thị D,1,6,0725-1105,0725,1105,Sáng,1-4,301.H3
20261,Toán,030101,030101,080101,Xác suất thống kê,3,68XD1 - GV Phạm Thị D,2,6,0725-1105,0725,1105,Sáng,7-12,301.H3
20261,Toán,030102,030102,080101,Xác suất thống kê,3,68XD2 - GV Phạm Thị D,1,4,1325-1610,1325,1610,Chiều,1-10,303.H3
20261,Xây dựng,010212,010212,010212,Cơ học cơ sở 2,3,68XD1 - GV Hoàng Văn E,1,3,0725-1005,0725,1005,Sáng,1-10,208.H1
20261,Xây dựng,010213,010213,010212,Cơ học cơ sở 2,3,68XD2 - GV Hoàng Văn E,1,5,0725-1005,0725,1005,Sáng,11-20,209.H1
20261,Ngoại ngữ,040101,040101,090101,Tiếng Anh 1,2,68IT1 - GV Ngô Thị F,1,5,0725-0915,0725,0915,Sáng,1-15,201.H2
`;
