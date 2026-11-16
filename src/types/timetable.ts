export interface RawCourseRow {
  Ky: string;
  Truong_Vien_Khoa: string;
  Ma_lop: string;
  Ma_lop_kem: string;
  Ma_HP: string;
  Ten_HP: string;
  Tieu_HP_Tieng_Anh?: string;
  Khoi_luong: string;
  Ghi_chu: string;
  Buoi_so: number;
  Thu: string;
  Thoi_gian: string;
  BD: string;
  KT: string;
  Kip: string;
  Tuan: string;
  Phong: string;
  Trang_thai?: string;
  Loai_lop?: string;
}

export interface ClassSession {
  buoiSo?: number;
  thu: number; // 2..8 (8 = Chủ nhật)
  tietStart: number;
  tietEnd: number;
  timeStartMinutes: number;
  timeEndMinutes: number;
  tuanHoc: number[];
  tuanRaw?: string;
  phong: string;
  ghiChu: string;
}

export interface Section {
  id: string;
  maHP: string;
  tenHP: string;
  sessions: ClassSession[];
}

export interface CourseGroup {
  maHP: string;
  tenHP: string;
  sections: Section[];
}

export interface SelectedCourseConfig {
  maHP: string;
  selectedSectionIds: string[];
}

export type TimeConstraints = {
  [day: number]: { sang: boolean; chieu: boolean };
};

export type SortOption =
  | 'random'
  | 'free_mornings'
  | 'free_afternoons'
  | 'free_sessions'
  | 'free_days'
  | 'morning_hours'
  | 'afternoon_hours';

export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  random: 'Ngẫu nhiên',
  free_mornings: 'Số buổi sáng được nghỉ',
  free_afternoons: 'Số buổi chiều được nghỉ',
  free_sessions: 'Số buổi được nghỉ',
  free_days: 'Số ngày được nghỉ',
  morning_hours: 'Số giờ học buổi sáng',
  afternoon_hours: 'Số giờ học buổi chiều',
};

export interface SolutionMetrics {
  freeMornings: number; // 0..7 buổi sáng được nghỉ / tuần
  freeAfternoons: number; // 0..7 buổi chiều được nghỉ / tuần
  freeSessions: number; // 0..14 buổi (sáng + chiều) được nghỉ / tuần
  freeDays: number; // 0..7 ngày được nghỉ trọn vẹn / tuần
  morningHours: number; // tổng số giờ học buổi sáng / tuần
  afternoonHours: number; // tổng số giờ học buổi chiều / tuần
}

export interface Solution {
  sectionIds: string[]; // chromosome
  maHPs: string[]; // học phần tương ứng từng gen
  fitness: number;
  conflicts: number;
  violations: number;
  gaps: number;
  metrics: SolutionMetrics;
}
