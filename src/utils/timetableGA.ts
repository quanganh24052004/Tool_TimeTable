import type {
  ClassSession,
  CourseGroup,
  Section,
  SelectedCourseConfig,
  Solution,
  SolutionMetrics,
  SortOption,
  TimeConstraints,
} from '../types/timetable';

const DAYS = [2, 3, 4, 5, 6, 7, 8];

export function weeksOverlap(a: number[], b: number[]): boolean {
  if (!a.length || !b.length) return true; // unknown weeks -> assume overlap
  const s = new Set(a);
  return b.some((w) => s.has(w));
}

export function sessionsConflict(a: ClassSession, b: ClassSession): boolean {
  return (
    a.thu === b.thu &&
    a.timeStartMinutes < b.timeEndMinutes &&
    b.timeStartMinutes < a.timeEndMinutes &&
    weeksOverlap(a.tuanHoc, b.tuanHoc)
  );
}

export const sectionsConflict = (a: Section, b: Section) =>
  a.sessions.some((x) => b.sessions.some((y) => sessionsConflict(x, y)));

/** Session violates constraint if it overlaps morning (<12:00) or afternoon (12:00–18:00) blocked */
export function sessionViolates(s: ClassSession, c: TimeConstraints): boolean {
  const d = c[s.thu];
  if (!d) return false;
  if (d.sang && s.timeStartMinutes < 12 * 60) return true;
  if (d.chieu && s.timeEndMinutes > 12 * 60 && s.timeStartMinutes < 18 * 60) return true;
  return false;
}

export interface GAOptions {
  populationSize?: number;
  generations?: number;
  mutationRate?: number;
  topK?: number;
  sortOption?: SortOption;
  onProgress?: (gen: number, total: number) => void;
}

interface Slot {
  maHP: string;
  candidates: Section[];
}

export function buildSlots(groups: CourseGroup[], selected: SelectedCourseConfig[]): Slot[] {
  return selected
    .map((cfg) => {
      const g = groups.find((x) => x.maHP === cfg.maHP);
      if (!g) return null;
      const allowed = cfg.selectedSectionIds.length
        ? g.sections.filter((s) => cfg.selectedSectionIds.includes(s.id))
        : g.sections;
      return allowed.length ? { maHP: g.maHP, candidates: allowed } : null;
    })
    .filter((x): x is Slot => !!x);
}

const rnd = (n: number) => Math.floor(Math.random() * n);

/** Total gap minutes between consecutive sessions on the same day (averaged across active weeks). */
function gapMinutes(secs: Section[]): number {
  const all = secs.flatMap((s) => s.sessions);
  const weeks = new Set<number>();
  all.forEach((x) => x.tuanHoc.forEach((w) => weeks.add(w)));
  let gap = 0;
  weeks.forEach((w) => {
    const byDay = new Map<number, ClassSession[]>();
    all.forEach((x) => {
      if (x.tuanHoc.includes(w)) byDay.set(x.thu, [...(byDay.get(x.thu) || []), x]);
    });
    byDay.forEach((list) => {
      list.sort((a, b) => a.timeStartMinutes - b.timeStartMinutes);
      for (let i = 1; i < list.length; i++) {
        gap += Math.max(0, list[i].timeStartMinutes - list[i - 1].timeEndMinutes);
      }
    });
  });
  return gap / Math.max(1, weeks.size);
}

/** Tính các chỉ số thống kê của phương án thời khóa biểu (phục vụ 7 tiêu chí sắp xếp/tối ưu). */
export function computeMetrics(secs: Section[]): SolutionMetrics {
  const busyMorningDays = new Set<number>();
  const busyAfternoonDays = new Set<number>();
  const busyDays = new Set<number>();

  // Gộp các buổi trùng (maHP, sec.id, thu, start, end) khác tuần để tính giờ học/tuần chuẩn xác
  const uniqueSlots = new Map<string, ClassSession>();
  for (const sec of secs) {
    for (const s of sec.sessions) {
      busyDays.add(s.thu);
      if (s.timeStartMinutes < 12 * 60) busyMorningDays.add(s.thu);
      if (s.timeEndMinutes > 12 * 60 && s.timeStartMinutes < 18 * 60) {
        busyAfternoonDays.add(s.thu);
      }
      const key = `${sec.maHP}|${sec.id}|${s.thu}|${s.timeStartMinutes}|${s.timeEndMinutes}`;
      if (!uniqueSlots.has(key)) uniqueSlots.set(key, s);
    }
  }

  let morningMins = 0;
  let afternoonMins = 0;
  uniqueSlots.forEach((s) => {
    const mStart = s.timeStartMinutes;
    const mEnd = Math.min(s.timeEndMinutes, 12 * 60);
    if (mEnd > mStart) morningMins += mEnd - mStart;

    const aStart = Math.max(s.timeStartMinutes, 12 * 60);
    const aEnd = Math.min(s.timeEndMinutes, 18 * 60);
    if (aEnd > aStart) afternoonMins += aEnd - aStart;
  });

  const freeMornings = DAYS.filter((d) => !busyMorningDays.has(d)).length;
  const freeAfternoons = DAYS.filter((d) => !busyAfternoonDays.has(d)).length;
  const freeSessions = freeMornings + freeAfternoons;
  const freeDays = DAYS.filter((d) => !busyDays.has(d)).length;

  return {
    freeMornings,
    freeAfternoons,
    freeSessions,
    freeDays,
    morningHours: Math.round((morningMins / 60) * 10) / 10,
    afternoonHours: Math.round((afternoonMins / 60) * 10) / 10,
  };
}

function optionBonus(m: SolutionMetrics, sortOption: SortOption): number {
  switch (sortOption) {
    case 'free_mornings':
      return m.freeMornings * 150 + m.freeDays * 30;
    case 'free_afternoons':
      return m.freeAfternoons * 150 + m.freeDays * 30;
    case 'free_sessions':
      return m.freeSessions * 100 + m.freeDays * 40;
    case 'free_days':
      return m.freeDays * 220 + m.freeSessions * 40;
    case 'morning_hours':
      return m.morningHours * 60 - m.afternoonHours * 30;
    case 'afternoon_hours':
      return m.afternoonHours * 60 - m.morningHours * 30;
    case 'random':
    default:
      return 0;
  }
}

export function evaluateFitness(
  chrom: Section[],
  c: TimeConstraints,
  sortOption: SortOption = 'random'
): Omit<Solution, 'sectionIds' | 'maHPs'> {
  let conflicts = 0;
  let violations = 0;
  for (let i = 0; i < chrom.length; i++) {
    for (let j = i + 1; j < chrom.length; j++) {
      if (sectionsConflict(chrom[i], chrom[j])) conflicts++;
    }
    chrom[i].sessions.forEach((s) => {
      if (sessionViolates(s, c)) violations++;
    });
  }
  const gaps = gapMinutes(chrom);
  const metrics = computeMetrics(chrom);
  const fitness =
    -10000 * conflicts -
    5000 * violations +
    optionBonus(metrics, sortOption) -
    gaps / 10;

  return { fitness, conflicts, violations, gaps, metrics };
}

export function compareBySortOption(a: Solution, b: Solution, sortOption: SortOption): number {
  // Luôn ưu tiên phương án hợp lệ (ít trùng lịch + ít vi phạm ngày nghỉ hơn) lên đầu
  const penaltyA = a.conflicts * 10 + a.violations;
  const penaltyB = b.conflicts * 10 + b.violations;
  if (penaltyA !== penaltyB) return penaltyA - penaltyB;

  switch (sortOption) {
    case 'free_mornings':
      if (b.metrics.freeMornings !== a.metrics.freeMornings) {
        return b.metrics.freeMornings - a.metrics.freeMornings;
      }
      break;
    case 'free_afternoons':
      if (b.metrics.freeAfternoons !== a.metrics.freeAfternoons) {
        return b.metrics.freeAfternoons - a.metrics.freeAfternoons;
      }
      break;
    case 'free_sessions':
      if (b.metrics.freeSessions !== a.metrics.freeSessions) {
        return b.metrics.freeSessions - a.metrics.freeSessions;
      }
      break;
    case 'free_days':
      if (b.metrics.freeDays !== a.metrics.freeDays) {
        return b.metrics.freeDays - a.metrics.freeDays;
      }
      break;
    case 'morning_hours':
      if (b.metrics.morningHours !== a.metrics.morningHours) {
        return b.metrics.morningHours - a.metrics.morningHours;
      }
      break;
    case 'afternoon_hours':
      if (b.metrics.afternoonHours !== a.metrics.afternoonHours) {
        return b.metrics.afternoonHours - a.metrics.afternoonHours;
      }
      break;
    case 'random':
    default:
      break;
  }
  return a.gaps - b.gaps;
}

export function generatePopulation(slots: Slot[], size: number): Section[][] {
  return Array.from({ length: size }, () =>
    slots.map((s) => s.candidates[rnd(s.candidates.length)])
  );
}

export function crossover(a: Section[], b: Section[]): Section[] {
  return a.map((g, i) => (Math.random() < 0.5 ? g : b[i]));
}

export function mutate(ch: Section[], slots: Slot[], rate: number): Section[] {
  return ch.map((g, i) =>
    Math.random() < rate ? slots[i].candidates[rnd(slots[i].candidates.length)] : g
  );
}

export async function runGA(
  groups: CourseGroup[],
  selected: SelectedCourseConfig[],
  constraints: TimeConstraints,
  opts: GAOptions = {}
): Promise<{ solutions: Solution[]; slots: number }> {
  const {
    populationSize = 180,
    generations = 80,
    mutationRate = 0.15,
    topK = 200,
    sortOption = 'random',
    onProgress,
  } = opts;
  const slots = buildSlots(groups, selected);
  if (!slots.length) return { solutions: [], slots: 0 };

  const best = new Map<string, Solution>();
  const record = (ch: Section[]) => {
    const key = ch.map((s) => `${s.maHP}:${s.id}`).join('|');
    if (best.has(key)) return;
    best.set(key, {
      sectionIds: ch.map((s) => s.id),
      maHPs: ch.map((s) => s.maHP),
      ...evaluateFitness(ch, constraints, sortOption),
    });
  };

  // Nếu tổng số tổ hợp nhỏ (<= 300, VD: chọn 1 môn 50 lớp hoặc vài môn ít lớp) -> duyệt đầy đủ 100% không bỏ sót phương án nào
  let totalCombinations = 1;
  for (const slot of slots) {
    totalCombinations *= slot.candidates.length;
    if (totalCombinations > 300) break;
  }

  if (totalCombinations <= 300) {
    const current: Section[] = [];
    const enumerate = (depth: number) => {
      if (depth === slots.length) {
        record([...current]);
        return;
      }
      for (const sec of slots[depth].candidates) {
        current.push(sec);
        enumerate(depth + 1);
        current.pop();
      }
    };
    enumerate(0);
    onProgress?.(generations, generations);
  } else {
    let pop = generatePopulation(slots, populationSize);
    for (let gen = 0; gen < generations; gen++) {
      const scored = pop.map((ch) => ({
        ch,
        f: evaluateFitness(ch, constraints, sortOption).fitness,
      }));
      scored.forEach((x) => record(x.ch));
      const tournament = () => {
        let w = scored[rnd(scored.length)];
        for (let k = 0; k < 2; k++) {
          const o = scored[rnd(scored.length)];
          if (o.f > w.f) w = o;
        }
        return w.ch;
      };
      scored.sort((a, b) => b.f - a.f);
      const elite = scored
        .slice(0, Math.max(2, Math.floor(populationSize * 0.05)))
        .map((x) => x.ch);
      const next = [...elite];
      while (next.length < populationSize) {
        next.push(mutate(crossover(tournament(), tournament()), slots, mutationRate));
      }
      pop = next;
      if (gen % 5 === 0) {
        onProgress?.(gen, generations);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    pop.forEach(record);
    onProgress?.(generations, generations);
  }

  const allCandidates = [...best.values()].sort((a, b) =>
    compareBySortOption(a, b, sortOption)
  );
  const validOnly = allCandidates.filter((s) => s.conflicts === 0 && s.violations === 0);
  const solutions = (validOnly.length > 0 ? validOnly : allCandidates).slice(0, topK);
  return { solutions, slots: slots.length };
}
