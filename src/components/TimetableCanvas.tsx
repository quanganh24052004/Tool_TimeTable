import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SORT_OPTION_LABELS,
  type ClassSession,
  type CourseGroup,
  type Section,
  type SelectedCourseConfig,
  type Solution,
  type SortOption,
  type TimeConstraints,
} from '../types/timetable';
import CourseSelector, { dayName } from './CourseSelector';
import ConstraintsConfig from './ConstraintsConfig';
import { cleanRoom, formatWeeks } from '../utils/excelParser';
import { dayOf, fmtDM, fmtDMY, weeksSpanDateLabel } from '../utils/weeks';

const START_H = 6;
const END_H = 21;
const PX_PER_H = 56;
const DAYS = [2, 3, 4, 5, 6, 7, 8];

const SORT_OPTIONS: SortOption[] = [
  'random',
  'free_mornings',
  'free_afternoons',
  'free_sessions',
  'free_days',
  'morning_hours',
  'afternoon_hours',
];

/** Bảng màu học phần trên lưới TKB theo design.md mục 2.5 */
const COURSE_THEMES = [
  {
    block: 'bg-primary-lighter border-primary-dark text-primary-darker shadow-[0_2px_0_#001E3B]',
    badge: 'bg-primary-main text-white border-primary-darker',
    chip: 'bg-primary-lighter border-primary-dark',
  },
  {
    block: 'bg-secondary-lighter border-secondary-dark text-secondary-darker shadow-[0_2px_0_#5219B7]',
    badge: 'bg-secondary-main text-white border-secondary-darker',
    chip: 'bg-secondary-lighter border-secondary-dark',
  },
  {
    block: 'bg-info-lighter border-info-dark text-info-darker shadow-[0_2px_0_#006C9C]',
    badge: 'bg-info-dark text-white border-info-darker',
    chip: 'bg-info-lighter border-info-dark',
  },
  {
    block: 'bg-success-lighter border-success-dark text-success-darker shadow-[0_2px_0_#108D57]',
    badge: 'bg-success-dark text-white border-success-darker',
    chip: 'bg-success-lighter border-success-dark',
  },
  {
    block: 'bg-warning-lighter border-warning-dark text-warning-darker shadow-[0_2px_0_#B76E00]',
    badge: 'bg-warning-dark text-white border-warning-darker',
    chip: 'bg-warning-lighter border-warning-dark',
  },
  {
    block: 'bg-error-lighter border-error-dark text-error-darker shadow-[0_2px_0_#B71D19]',
    badge: 'bg-error-main text-white border-error-darker',
    chip: 'bg-error-lighter border-error-dark',
  },
  {
    block: 'bg-primary-light border-primary-dark text-primary-darker shadow-[0_2px_0_#001E3B]',
    badge: 'bg-primary-darker text-white border-primary-darker',
    chip: 'bg-primary-light border-primary-dark',
  },
  {
    block: 'bg-secondary-light border-secondary-dark text-secondary-darker shadow-[0_2px_0_#5219B7]',
    badge: 'bg-secondary-darker text-white border-secondary-darker',
    chip: 'bg-secondary-light border-secondary-dark',
  },
  {
    block: 'bg-info-light border-info-dark text-info-darker shadow-[0_2px_0_#006C9C]',
    badge: 'bg-info-darker text-white border-info-darker',
    chip: 'bg-info-light border-info-dark',
  },
  {
    block: 'bg-success-light border-success-dark text-success-darker shadow-[0_2px_0_#108D57]',
    badge: 'bg-success-darker text-white border-success-darker',
    chip: 'bg-success-light border-success-dark',
  },
  {
    block: 'bg-warning-light border-warning-dark text-warning-darker shadow-[0_2px_0_#B76E00]',
    badge: 'bg-warning-darker text-white border-warning-darker',
    chip: 'bg-warning-light border-warning-dark',
  },
  {
    block: 'bg-error-light border-error-dark text-error-darker shadow-[0_2px_0_#B71D19]',
    badge: 'bg-error-darker text-white border-error-darker',
    chip: 'bg-error-light border-error-dark',
  },
];

const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface Props {
  solutions: Solution[];
  groups: CourseGroup[];
  selectedHP: string[];
  sortOption: SortOption;
  onChangeSortOption: (opt: SortOption) => void;
  onBack?: () => void;
  selected?: SelectedCourseConfig[];
  setSelected?: (s: SelectedCourseConfig[]) => void;
  constraints?: TimeConstraints;
  setConstraints?: (c: TimeConstraints) => void;
  onReRun?: () => void;
  isRunning?: boolean;
}

interface Block {
  sec: Section;
  colorIdx: number;
  buoiSo: number;
  thu: number;
  start: number;
  end: number;
  weeks: number[];
  tuanRaw: string;
  phong: string;
  ghiChu: string;
  lane: number;
  lanes: number;
  conflicted: boolean;
}

/**
 * Mỗi buổi học (phân biệt theo Buổi_số) được giữ nguyên thành 1 Block riêng biệt
 * để giữ đúng chuỗi Tuần gốc của buổi đó và tự động chia đôi / chia N width khi trùng ô giờ ở chế độ Toàn bộ.
 */
function sessionToBlock(sec: Section, colorIdx: number, x: ClassSession, idx: number): Block {
  return {
    sec,
    colorIdx,
    buoiSo: x.buoiSo ?? idx + 1,
    thu: x.thu,
    start: x.timeStartMinutes,
    end: x.timeEndMinutes,
    weeks: [...x.tuanHoc].sort((a, c) => a - c),
    tuanRaw: x.tuanRaw ?? '',
    phong: cleanRoom(x.phong),
    ghiChu: x.ghiChu,
    lane: 0,
    lanes: 1,
    conflicted: false,
  };
}

/**
 * Chia làn (split width):
 * - Nếu trong cùng 1 ô thời gian có 2 buổi / mã lớp nhưng khác tuần -> chia đôi width (50% / 50%).
 * - Nếu có N buổi / mã lớp giao thời gian -> chia đều 1/N width, sắp xếp theo tuần tăng dần từ trái sang phải.
 */
function layoutLanes(blocks: Block[]): Block[] {
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.sec.maHP !== b.sec.maHP && a.start < b.end && b.start < a.end) {
        const weekOverlap =
          !a.weeks.length || !b.weeks.length || a.weeks.some((w) => b.weeks.includes(w));
        if (weekOverlap) {
          a.conflicted = true;
          b.conflicted = true;
        }
      }
    }
  }

  const sorted = [...blocks].sort(
    (a, b) =>
      a.start - b.start ||
      (a.weeks[0] ?? 0) - (b.weeks[0] ?? 0) ||
      b.end - a.end ||
      a.sec.id.localeCompare(b.sec.id) ||
      a.buoiSo - b.buoiSo
  );

  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    cluster.forEach((b) => {
      let lane = laneEnds.findIndex((e) => e <= b.start);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(b.end);
      } else {
        laneEnds[lane] = b.end;
      }
      b.lane = lane;
    });
    cluster.forEach((b) => {
      b.lanes = laneEnds.length;
    });
    cluster = [];
  };

  sorted.forEach((b) => {
    if (cluster.length && b.start >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  });
  if (cluster.length) flush();
  return sorted;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function TimetableCanvas({
  solutions,
  groups,
  selectedHP,
  sortOption,
  onChangeSortOption,
  onBack,
  selected,
  setSelected,
  constraints,
  setConstraints,
  onReRun,
  isRunning = false,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState('1');
  const [mode, setMode] = useState<'all' | 'week'>('all');
  const [week, setWeek] = useState(1);
  const [optionMenuOpen, setOptionMenuOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const optionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIdx(0);
    setEditingPage(false);
  }, [solutions]);

  const safeIdx = Math.min(idx, Math.max(0, solutions.length - 1));
  const jumpToResult = (targetOneBased: number) => {
    if (!solutions.length) return;
    const clamped = Math.min(Math.max(1, Math.round(targetOneBased)), solutions.length);
    setIdx(clamped - 1);
  };

  useEffect(() => {
    if (!optionMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (optionMenuRef.current && !optionMenuRef.current.contains(e.target as Node)) {
        setOptionMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOptionMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [optionMenuOpen]);

  const sol = solutions[Math.min(idx, Math.max(0, solutions.length - 1))];

  const sections: Section[] = useMemo(() => {
    if (!sol) return [];
    return sol.sectionIds
      .map((id, i) => {
        const hp = sol.maHPs?.[i] ?? selectedHP[i];
        return (
          groups.find((g) => g.maHP === hp)?.sections.find((s) => s.id === id) ??
          groups.flatMap((g) => g.sections).find((s) => s.id === id)
        );
      })
      .filter((s): s is Section => !!s);
  }, [sol, groups, selectedHP]);

  const allWeeks = useMemo(
    () =>
      [...new Set(sections.flatMap((s) => s.sessions.flatMap((x) => x.tuanHoc)))]
        .filter((n) => Number.isFinite(n) && n >= 1)
        .sort((a, b) => a - b),
    [sections]
  );

  const minWeek = allWeeks[0] ?? 1;
  const maxWeek = allWeeks[allWeeks.length - 1] ?? 1;

  useEffect(() => {
    if (!allWeeks.length) return;
    setWeek((w) => (allWeeks.includes(w) ? w : allWeeks[0]));
  }, [allWeeks]);

  const blocksByDay = useMemo(() => {
    const res = new Map<number, Block[]>();
    DAYS.forEach((d) => {
      const dayBlocks = sections.flatMap((sec, si) =>
        sec.sessions
          .filter((x) => x.thu === d && (mode === 'all' || x.tuanHoc.includes(week)))
          .map((x, sIdx) => sessionToBlock(sec, si, x, sIdx))
      );
      res.set(d, layoutLanes(dayBlocks));
    });
    return res;
  }, [sections, mode, week]);

  if (!solutions.length) {
    return (
      <section className="card-tactile flex min-h-[420px] flex-col items-center justify-center border-dashed border-grey-300 bg-grey-100 p-6 text-center">
        <div
          aria-hidden="true"
          className="mb-3 flex h-16 w-16 items-center justify-center rounded-card border-2 border-grey-300 bg-white text-3xl shadow-tactile-grey-md"
        >
          🗓️
        </div>
        <h2 className="text-base font-bold text-grey-800">Chưa có phương án thời khóa biểu</h2>
        <p className="mt-1 max-w-md text-sm font-medium text-grey-600">
          Hãy chọn học phần và bấm xếp thời khóa biểu để xem kết quả.
        </p>
        {onBack && (
          <button type="button" onClick={onBack} className="btn-tactile-primary-md mt-4">
            ⬅ Quay lại chọn học phần
          </button>
        )}
      </section>
    );
  }

  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const clampWeek = (w: number) => Math.min(Math.max(w, 1), Math.max(maxWeek, 1));
  const weekHasClass = (w: number) => allWeeks.includes(w);
  const gapHours = sol.gaps / 60;
  const today = new Date();
  const weekList = Array.from({ length: Math.max(maxWeek, 1) }, (_, i) => i + 1);
  const m = sol.metrics;

  return (
    <section className="card-tactile animate-pop-in">
      {/* Thanh Header Điều hướng Cửa sổ Kết quả: Nút Quay lại + Sửa Option + In PDF */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2.5 border-b-2 border-grey-200 pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-tactile-neutral border-grey-400 font-bold"
            >
              <span aria-hidden="true">⬅</span>
              <span>Quay lại thay đổi TKB</span>
            </button>
          )}

          {selected && setSelected && constraints && setConstraints && (
            <button
              type="button"
              onClick={() => setConfigDrawerOpen(true)}
              className="btn-tactile-info"
            >
              <span aria-hidden="true">⚙️</span>
              <span>Sửa học phần & ngày nghỉ</span>
            </button>
          )}
        </div>

        {/* Cụm nút bên phải: Popover Sửa Option (7 tiêu chí) + Nút In */}
        <div className="flex flex-wrap items-center gap-2">
          <div ref={optionMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setOptionMenuOpen((o) => !o)}
              disabled={isRunning}
              aria-haspopup="listbox"
              aria-expanded={optionMenuOpen}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-secondary-darker bg-secondary-lighter px-3.5 py-2 text-sm font-bold text-secondary-darker shadow-tactile-secondary-sm transition-all duration-150 ease-spring hover:bg-secondary-light/60 active:translate-y-[3px] active:shadow-tactile-none"
            >
              <span aria-hidden="true">🎯</span>
              <span>Tiêu chí: {SORT_OPTION_LABELS[sortOption]}</span>
              <span aria-hidden="true" className="text-xs">
                ▾
              </span>
            </button>

            {optionMenuOpen && (
              <div
                role="listbox"
                aria-label="Chọn tiêu chí sắp xếp các tập hợp kết quả"
                className="right-0 z-50 mt-2 w-64 animate-pop-in overflow-hidden rounded-card border-2 border-grey-300 bg-white/95 p-1.5 shadow-tactile-card backdrop-blur-md sm:absolute"
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-grey-500">
                  Sắp xếp / Tối ưu theo
                </div>
                {SORT_OPTIONS.map((opt) => {
                  const active = opt === sortOption;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setOptionMenuOpen(false);
                        onChangeSortOption(opt);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-primary-lighter font-bold text-primary-darker'
                          : 'text-grey-800 hover:bg-grey-100'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block w-4 text-center font-extrabold ${
                          active ? 'text-primary-darker' : 'text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span>{SORT_OPTION_LABELS[opt]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            aria-label="In hoặc xuất PDF thời khóa biểu"
            className="btn-tactile-info"
          >
            <span aria-hidden="true">🖨</span>
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* Thanh thông tin Tổng số Kết quả & chọn nhanh Phương án (4.6) */}
      <div className="no-print mb-3.5 flex flex-wrap items-center gap-2">
        <span className="badge-info shrink-0 tabular-nums">
          📋 Tổng kết quả: {solutions.length}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {solutions.slice(0, 8).map((s, i) => {
            const active = i === safeIdx;
            const hasIssue = s.conflicts > 0 || s.violations > 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={active ? 'btn-tactile-primary-md' : 'btn-tactile-neutral'}
              >
                <span>Kết quả {i + 1}</span>
                {hasIssue ? (
                  <span
                    title="Phương án có trùng lịch hoặc vi phạm buổi nghỉ"
                    className="inline-flex items-center rounded-full border border-warning-dark bg-warning-lighter px-1.5 py-0.5 text-[10px] font-bold text-warning-darker"
                  >
                    ⚠️
                  </span>
                ) : (
                  <span aria-hidden="true" className="text-xs">
                    ✅
                  </span>
                )}
              </button>
            );
          })}
          {solutions.length > 8 && (
            <span className="text-xs font-semibold text-grey-600">
              (+{solutions.length - 8} kết quả khác ở thanh chuyển bên dưới)
            </span>
          )}
        </div>
      </div>

      {/* Thanh Chế độ xem & Bộ chọn tuần (4.6) */}
      <div className="no-print mb-3.5 flex flex-wrap items-center gap-2.5 text-sm">
        <div className="inline-flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode('all')}
            className={mode === 'all' ? 'btn-tactile-info' : 'btn-tactile-neutral'}
          >
            📚 Toàn bộ học kỳ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('week');
              setWeek((w) => (weekHasClass(w) ? w : minWeek));
            }}
            className={mode === 'week' ? 'btn-tactile-info' : 'btn-tactile-neutral'}
          >
            📅 Chi tiết từng tuần
          </button>
        </div>

        {mode === 'week' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-label="Tuần trước"
              onClick={() => setWeek((w) => clampWeek(w - 1))}
              disabled={week <= 1}
              className="btn-tactile-neutral px-3"
            >
              ◀
            </button>
            <select
              aria-label="Chọn tuần học"
              value={week}
              onChange={(e) => setWeek(+e.target.value)}
              className="input-tactile w-auto cursor-pointer pr-8 font-bold tabular-nums"
            >
              {weekList.map((w) => (
                <option key={w} value={w}>
                  Tuần {w} ({fmtDM(dayOf(w, 2))} – {fmtDM(dayOf(w, 8))})
                  {weekHasClass(w) ? '' : ' (trống)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Tuần tiếp theo"
              onClick={() => setWeek((w) => clampWeek(w + 1))}
              disabled={week >= maxWeek}
              className="btn-tactile-neutral px-3"
            >
              ▶
            </button>
            <span className="badge-info tabular-nums">
              🗓 {fmtDMY(dayOf(week, 2))} → {fmtDMY(dayOf(week, 8))}
            </span>
          </div>
        ) : (
          <span className="badge-neutral tabular-nums">
            🗓 Tuần {minWeek} ({fmtDMY(dayOf(minWeek, 2))}) → Tuần {maxWeek} ({fmtDMY(dayOf(maxWeek, 8))})
          </span>
        )}
      </div>

      {/* Thanh trạng thái & Chỉ số thống kê theo Option */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`${sol.conflicts > 0 ? 'badge-error' : 'badge-success'} tabular-nums`}>
          <span>{sol.conflicts > 0 ? '⚠️' : '✅'}</span>
          <span>Trùng lịch: {sol.conflicts}</span>
        </span>
        <span className={`${sol.violations > 0 ? 'badge-error' : 'badge-success'} tabular-nums`}>
          <span>{sol.violations > 0 ? '⚠️' : '✅'}</span>
          <span>Vi phạm ngày nghỉ: {sol.violations}</span>
        </span>
        <span className={`${gapHours > 3 ? 'badge-warning' : 'badge-neutral'} tabular-nums`}>
          <span>{gapHours > 3 ? '⏳' : '⏱'}</span>
          <span>Giờ trống TB/tuần: {gapHours.toFixed(1)}h</span>
        </span>

        {m && (
          <>
            <span
              className={`${
                sortOption === 'free_days' ? 'badge-info' : 'badge-neutral'
              } tabular-nums`}
            >
              🏖 Ngày được nghỉ: {m.freeDays}/7
            </span>
            <span
              className={`${
                sortOption === 'free_sessions' ? 'badge-info' : 'badge-neutral'
              } tabular-nums`}
            >
              🛋 Buổi được nghỉ: {m.freeSessions}/14
            </span>
            <span
              className={`${
                sortOption === 'free_mornings' ? 'badge-info' : 'badge-neutral'
              } tabular-nums`}
            >
              ☀️ Sáng được nghỉ: {m.freeMornings}/7
            </span>
            <span
              className={`${
                sortOption === 'free_afternoons' ? 'badge-info' : 'badge-neutral'
              } tabular-nums`}
            >
              🌤 Chiều được nghỉ: {m.freeAfternoons}/7
            </span>
            <span
              className={`${
                sortOption === 'morning_hours' || sortOption === 'afternoon_hours'
                  ? 'badge-info'
                  : 'badge-neutral'
              } tabular-nums`}
            >
              📊 Giờ học Sáng: {m.morningHours}h · Chiều: {m.afternoonHours}h
            </span>
          </>
        )}
      </div>

      {/* Lưới thời khóa biểu (4.6) */}
      <div
        key={`${idx}-${mode}-${mode === 'week' ? week : 'all'}`}
        className="animate-slide-fade overflow-x-auto rounded-2xl border-2 border-grey-300 bg-white"
      >
        <div className="min-w-[880px]">
          <div className="grid" style={{ gridTemplateColumns: '54px repeat(7, 1fr)' }}>
            {/* Ô góc trên trái */}
            <div className="border-b-2 border-grey-300 bg-grey-100 py-2 text-center text-[11px] font-bold text-grey-600">
              Giờ
            </div>

            {/* Tiêu đề các Thứ */}
            {DAYS.map((d) => {
              const dateObj = dayOf(week, d);
              const isToday = mode === 'week' && isSameCalendarDay(dateObj, today);
              return (
                <div
                  key={d}
                  className={`border-b-2 border-l-2 py-2 text-center text-sm font-bold ${
                    isToday
                      ? 'border-primary-main bg-primary-lighter text-primary-darker'
                      : 'border-grey-300 bg-grey-100 text-grey-800'
                  }`}
                >
                  <div>{d === 8 ? 'Chủ nhật' : `Thứ ${d}`}</div>
                  {mode === 'week' && (
                    <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-grey-600">
                      {fmtDM(dateObj)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Cột trục giờ */}
            <div className="relative bg-grey-50" style={{ height: hours.length * PX_PER_H }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-1.5 -translate-y-2 text-[11px] font-semibold tabular-nums text-grey-600"
                  style={{ top: i * PX_PER_H }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Các cột ngày */}
            {DAYS.map((d) => {
              const dateObj = dayOf(week, d);
              const isToday = mode === 'week' && isSameCalendarDay(dateObj, today);
              return (
                <div
                  key={d}
                  className={`relative border-l-2 ${
                    isToday ? 'border-primary-main' : 'border-grey-200'
                  }`}
                  style={{ height: hours.length * PX_PER_H }}
                >
                  {/* Vùng nền Sáng / Chiều / Tối rất nhạt */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bg-warning-lighter/25"
                    style={{ top: 0, height: (12 - START_H) * PX_PER_H }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bg-info-lighter/20"
                    style={{
                      top: (12 - START_H) * PX_PER_H,
                      height: (18 - 12) * PX_PER_H,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bg-secondary-lighter/20"
                    style={{
                      top: (18 - START_H) * PX_PER_H,
                      height: (END_H - 18) * PX_PER_H,
                    }}
                  />

                  {/* Vạch kẻ từng giờ */}
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className={`pointer-events-none absolute w-full border-t ${
                        h === 12 || h === 18 ? 'border-grey-300' : 'border-grey-200'
                      }`}
                      style={{ top: i * PX_PER_H }}
                    />
                  ))}

                  {/* Các khối môn học */}
                  {(blocksByDay.get(d) || []).map((b, k) => {
                    const top = (b.start / 60 - START_H) * PX_PER_H;
                    const height = Math.max(28, ((b.end - b.start) / 60) * PX_PER_H - 2);
                    const w = 100 / b.lanes;
                    const theme = COURSE_THEMES[b.colorIdx % COURSE_THEMES.length];
                    const weekText = formatWeeks(b.weeks, b.tuanRaw);
                    const dateSpan = weeksSpanDateLabel(b.weeks);

                    return (
                      <div
                        key={k}
                        className={`tactile-block absolute z-10 overflow-hidden rounded-block border-2 p-1 text-[10px] font-semibold leading-[1.15] transition-transform duration-150 ease-spring hover:z-30 hover:-translate-y-0.5 ${
                          theme.block
                        } ${b.conflicted ? '!border-dashed !border-error-main ring-1 ring-error-main' : ''}`}
                        style={{
                          top,
                          height,
                          left: `calc(${b.lane * w}% + 1px)`,
                          width: `calc(${w}% - 2px)`,
                        }}
                        title={`${b.sec.tenHP} (${b.sec.maHP})\nLớp ${b.sec.id} (Buổi ${b.buoiSo})\n${fmt(b.start)}–${fmt(b.end)}\nTuần ${weekText}${dateSpan ? ` (${dateSpan})` : ''}\nPhòng ${b.phong}\n${b.ghiChu}`}
                      >
                        <div className="truncate font-bold">
                          {b.conflicted && <span aria-label="Trùng lịch">⚠️ </span>}
                          {b.sec.tenHP}
                        </div>
                        <div className="truncate tabular-nums">
                          {fmt(b.start)}–{fmt(b.end)}
                        </div>
                        <div className="truncate tabular-nums">Lớp {b.sec.id}</div>
                        {b.phong && <div className="truncate">{b.phong}</div>}
                        <div className="truncate font-bold tabular-nums">
                          Tuần {weekText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Thanh chuyển giữa các kết quả phía dưới Canvas */}
      <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-grey-200 bg-grey-50 p-3">
        <button
          type="button"
          onClick={() => jumpToResult(1)}
          disabled={safeIdx === 0}
          className="btn-tactile-neutral px-3 text-xs sm:text-sm"
        >
          <span aria-hidden="true">⏮</span>
          <span>Kết quả đầu</span>
        </button>

        <button
          type="button"
          onClick={() => jumpToResult(safeIdx)}
          disabled={safeIdx === 0}
          className="btn-tactile-neutral px-3 text-xs sm:text-sm"
        >
          <span aria-hidden="true">◀</span>
          <span>Kết quả trước</span>
        </button>

        {editingPage ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = parseInt(pageInput, 10);
              if (!Number.isNaN(num)) jumpToResult(num);
              setEditingPage(false);
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border-2 border-primary-main bg-white px-3 py-1 shadow-tactile-input-focus"
          >
            <span className="text-xs font-bold text-grey-700 sm:text-sm">Kết quả</span>
            <input
              type="number"
              min={1}
              max={solutions.length}
              autoFocus
              aria-label="Nhập số thứ tự kết quả"
              value={pageInput}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const num = parseInt(pageInput, 10);
                if (!Number.isNaN(num)) jumpToResult(num);
                setEditingPage(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingPage(false);
                }
              }}
              className="w-14 rounded-lg border-2 border-grey-300 px-1.5 py-0.5 text-center text-sm font-bold tabular-nums text-primary-darker outline-none focus:border-primary-main"
            />
            <span className="text-xs font-bold tabular-nums text-grey-600 sm:text-sm">
              / {solutions.length}
            </span>
          </form>
        ) : (
          <button
            type="button"
            title="Bấm vào số để nhập thứ tự kết quả muốn xem"
            onClick={() => {
              setPageInput(String(safeIdx + 1));
              setEditingPage(true);
            }}
            className="btn-tactile-info px-4 text-xs sm:text-sm tabular-nums"
          >
            <span>
              Kết quả{' '}
              <span className="mx-0.5 inline-block rounded-md border border-info-dark bg-white px-2 py-0.5 font-extrabold text-primary-main">
                {safeIdx + 1}
              </span>{' '}
              / {solutions.length}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => jumpToResult(safeIdx + 2)}
          disabled={safeIdx >= solutions.length - 1}
          className="btn-tactile-neutral px-3 text-xs sm:text-sm"
        >
          <span>Kết quả sau</span>
          <span aria-hidden="true">▶</span>
        </button>

        <button
          type="button"
          onClick={() => jumpToResult(solutions.length)}
          disabled={safeIdx >= solutions.length - 1}
          className="btn-tactile-neutral px-3 text-xs sm:text-sm"
        >
          <span>Kết quả cuối</span>
          <span aria-hidden="true">⏭</span>
        </button>
      </div>

      {/* Chú thích (Legend) bên dưới (4.6) */}
      <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s, i) => {
          const theme = COURSE_THEMES[i % COURSE_THEMES.length];
          const secWeeks = [...new Set(s.sessions.flatMap((x) => x.tuanHoc))].sort((a, b) => a - b);
          const secWeekStr = formatWeeks(secWeeks, s.sessions[0]?.tuanRaw);
          return (
            <li
              key={i}
              className="flex items-center gap-2.5 rounded-xl border-2 border-grey-200 bg-grey-50 px-3 py-2"
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-4 shrink-0 rounded-md border-2 ${theme.chip}`}
              />
              <span className="min-w-0 truncate font-medium text-grey-800">
                <b className="font-bold tabular-nums">{s.maHP}</b> · {s.tenHP} —{' '}
                <span className="font-bold tabular-nums text-grey-700">Lớp {s.id}</span> (
                {[...new Set(s.sessions.map((x) => dayName(x.thu)))].join(', ')} · Tuần {secWeekStr})
              </span>
            </li>
          );
        })}
      </ul>

      {/* Modal / Drawer Sửa nhanh học phần, ngày nghỉ & option ngay trên màn hình Canvas */}
      {configDrawerOpen && selected && setSelected && constraints && setConstraints && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/[0.48] p-0 sm:items-center sm:p-4"
          onClick={() => setConfigDrawerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sửa tùy chọn thời khóa biểu"
            className="animate-pop-in flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-card border-2 border-grey-300 bg-grey-100 shadow-tactile-card sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-grey-300 bg-white px-4 py-3.5 sm:px-5">
              <div>
                <h3 className="text-base font-bold text-grey-800">
                  ⚙️ Tùy chỉnh nhanh học phần, ngày nghỉ & tiêu chí
                </h3>
                <p className="text-xs font-medium text-grey-600">
                  Chỉnh sửa trực tiếp và bấm "Áp dụng & Xếp lại TKB" để cập nhật ngay trên lưới.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng cửa sổ tùy chỉnh"
                onClick={() => setConfigDrawerOpen(false)}
                className="btn-icon-danger"
              >
                ✕
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-2">
              <CourseSelector groups={groups} selected={selected} setSelected={setSelected} />
              <div className="space-y-4">
                <ConstraintsConfig value={constraints} onChange={setConstraints} />

                <section className="card-tactile">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="step-badge" aria-hidden="true">
                      4
                    </span>
                    <h2 className="text-base font-bold text-grey-800">Tiêu chí ưu tiên kết quả</h2>
                  </div>
                  <div className="grid gap-1.5">
                    {SORT_OPTIONS.map((opt) => {
                      const active = opt === sortOption;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => onChangeSortOption(opt)}
                          className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition-all ${
                            active
                              ? 'border-primary-darker bg-primary-lighter font-bold text-primary-darker shadow-tactile-primary-sm'
                              : 'border-grey-200 bg-white text-grey-800 hover:bg-grey-50'
                          }`}
                        >
                          <span className="w-4 text-center font-extrabold">
                            {active ? '✓' : ''}
                          </span>
                          <span>{SORT_OPTION_LABELS[opt]}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t-2 border-grey-300 bg-white px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setConfigDrawerOpen(false)}
                className="btn-tactile-neutral"
              >
                Đóng
              </button>
              {onReRun && (
                <button
                  type="button"
                  onClick={() => {
                    setConfigDrawerOpen(false);
                    onReRun();
                  }}
                  className="btn-tactile-primary-md px-5"
                >
                  🧬 Áp dụng & Xếp lại TKB
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
