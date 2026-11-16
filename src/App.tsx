import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import FileUploader from './components/FileUploader';
import CourseSelector from './components/CourseSelector';
import ConstraintsConfig, { emptyConstraints } from './components/ConstraintsConfig';
import TimetableCanvas from './components/TimetableCanvas';
import Toast from './components/Toast';
import {
  SORT_OPTION_LABELS,
  type CourseGroup,
  type RawCourseRow,
  type SelectedCourseConfig,
  type Solution,
  type SortOption,
  type TimeConstraints,
} from './types/timetable';
import {
  buildCourseGroups,
  parseArrayBuffer,
  parseCSVText,
  parseFile,
  PARSER_VERSION,
  SAMPLE_CSV,
} from './utils/excelParser';
import { buildSlots, runGA } from './utils/timetableGA';
import {
  clearCachedSession,
  loadCachedRows,
  loadCachedSession,
  saveCachedRows,
  saveCachedSession,
} from './utils/storage';
import huceExcelUrl from '../.doc/Lich_Hoc_Toan_Truong_HUCE_Ky_303.xlsx?url';

const SORT_OPTIONS: SortOption[] = [
  'random',
  'free_mornings',
  'free_afternoons',
  'free_sessions',
  'free_days',
  'morning_hours',
  'afternoon_hours',
];

export default function App() {
  const initialCache = useMemo(() => loadCachedSession(), []);

  const [fileName, setFileName] = useState<string | null>(() => initialCache?.fileName ?? null);
  const [isSample, setIsSample] = useState<boolean>(() => initialCache?.isSample ?? false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<RawCourseRow[]>([]);
  const [restoringRows, setRestoringRows] = useState<boolean>(() => Boolean(initialCache?.fileName));

  const [selected, setSelected] = useState<SelectedCourseConfig[]>(
    () => initialCache?.selected ?? []
  );
  const [constraints, setConstraints] = useState<TimeConstraints>(() => ({
    ...emptyConstraints(),
    ...(initialCache?.constraints ?? {}),
  }));
  const [sortOption, setSortOption] = useState<SortOption>(
    () => initialCache?.sortOption ?? 'random'
  );
  const [solutions, setSolutions] = useState<Solution[]>(() => initialCache?.solutions ?? []);
  const [progress, setProgress] = useState<number | null>(null);
  const [view, setView] = useState<'setup' | 'canvas'>(() =>
    initialCache?.view === 'canvas' && (initialCache.solutions?.length ?? 0) > 0
      ? 'canvas'
      : 'setup'
  );
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const hydratedRef = useRef(false);

  // Tự động tính lại groups từ rawRows và PARSER_VERSION để luôn đồng bộ ngay cả khi HMR
  const groups: CourseGroup[] = useMemo(
    () => buildCourseGroups(rawRows),
    [rawRows, PARSER_VERSION]
  );

  // Đồng bộ điều hướng màn hình với History API của trình duyệt (hỗ trợ nút Back/Forward)
  useEffect(() => {
    if (view === 'canvas' && window.history.state?.view !== 'canvas') {
      window.history.replaceState({ view: 'canvas' }, '', '#ket-qua-tkb');
    }
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.view === 'canvas') {
        setView('canvas');
      } else {
        setView('setup');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const pushCanvasWindow = useCallback(() => {
    setView('canvas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.history.state?.view !== 'canvas') {
      window.history.pushState({ view: 'canvas' }, '', '#ket-qua-tkb');
    }
  }, []);

  const backToSetupWindow = useCallback(() => {
    setView('setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.history.state?.view === 'canvas') {
      window.history.back();
    }
  }, []);

  const load = useCallback(
    (name: string, rows: RawCourseRow[], resetSelection = true, sampleFlag = false) => {
      const g = buildCourseGroups(rows);
      if (!g.length) {
        setToast({
          msg: 'Không đọc được dữ liệu. Kiểm tra lại tên cột (Ma_HP, Ma_lop, Thu, BD, KT, Tuan...).',
          type: 'error',
        });
        return;
      }
      setRawRows(rows);
      setFileName(name);
      setIsSample(sampleFlag);
      saveCachedRows(rows).catch(() => {});

      if (resetSelection) {
        setSelected([]);
        setSolutions([]);
        setView('setup');
      }
      const noWeek = g.reduce(
        (n, c) =>
          n + c.sections.reduce((m, s) => m + s.sessions.filter((x) => !x.tuanHoc.length).length, 0),
        0
      );
      if (resetSelection) {
        const sampleMissing = rows.find((r) => !r.Tuan || !String(r.Tuan).trim()) ?? rows[0];
        if (noWeek > 0) {
          console.warn('[HUCE TKB] Buổi thiếu tuần. Dòng mẫu:', sampleMissing);
        }
        setToast(
          noWeek
            ? {
                msg: `Đã tải ${name} (${g.length} học phần) nhưng ${noWeek} buổi học không đọc được cột Tuần (giá trị cột Tuần ở dòng đầu: "${sampleMissing?.Tuan ?? 'trống'}").`,
                type: 'error',
              }
            : { msg: `Đã tải lên thành công file ${name}! (${g.length} học phần)`, type: 'success' }
        );
      }
    },
    []
  );

  const onFile = async (f: File) => {
    try {
      setUploadedFile(f);
      load(f.name, await parseFile(f), true, false);
    } catch (e) {
      setToast({ msg: 'Lỗi đọc file: ' + (e as Error).message, type: 'error' });
    }
  };

  const loadSample = useCallback(
    async (resetSelection = true) => {
      try {
        const res = await fetch(huceExcelUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const rows = await parseArrayBuffer(buf);
          if (rows.length > 0) {
            load('Lich_Hoc_Toan_Truong_HUCE_Ky_303.xlsx', rows, resetSelection, true);
            return;
          }
        }
      } catch {
        // Fallback sang SAMPLE_CSV nếu không tải được file mẫu .xlsx
      }
      load('Du_lieu_mau.csv', parseCSVText(SAMPLE_CSV), resetSelection, true);
    },
    [load]
  );

  // Khôi phục dữ liệu bảng học phần từ IndexedDB khi mở lại trình duyệt
  useEffect(() => {
    let active = true;
    if (!initialCache?.fileName) {
      setRestoringRows(false);
      hydratedRef.current = true;
      return;
    }

    loadCachedRows().then((cachedRows) => {
      if (!active) return;
      if (cachedRows.length > 0) {
        setRawRows(cachedRows);
        setRestoringRows(false);
        hydratedRef.current = true;
      } else if (initialCache.isSample) {
        loadSample(false).finally(() => {
          if (active) {
            setRestoringRows(false);
            hydratedRef.current = true;
          }
        });
      } else {
        // Nếu IndexedDB bị trình duyệt dọn nhưng localStorage còn, giữ nguyên selected/solutions và báo nhẹ
        setRestoringRows(false);
        hydratedRef.current = true;
      }
    });

    return () => {
      active = false;
    };
  }, [initialCache, loadSample]);

  // Tự động lưu cache mỗi khi người dùng chọn môn, đổi ngày nghỉ, đổi option, xếp TKB hoặc chuyển màn hình
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveCachedSession({
      fileName,
      isSample,
      selected,
      constraints,
      sortOption,
      solutions,
      view,
    });
  }, [fileName, isSample, selected, constraints, sortOption, solutions, view]);

  // Tự động đọc lại dữ liệu (giữ nguyên môn đã chọn & phương án hiện tại) nếu phát hiện buổi học thiếu tuần do HMR
  const hasMissingWeeks = useMemo(
    () =>
      groups.some((c) => c.sections.some((s) => s.sessions.some((x) => x.tuanHoc.length === 0))),
    [groups]
  );

  useEffect(() => {
    if (restoringRows) return;
    if ((fileName && rawRows.length === 0 && isSample) || hasMissingWeeks) {
      if (uploadedFile) {
        parseFile(uploadedFile)
          .then((rows) => load(uploadedFile.name, rows, false, false))
          .catch(() => loadSample(false));
      } else if (isSample || hasMissingWeeks) {
        loadSample(false);
      }
    }
  }, [restoringRows, fileName, rawRows.length, isSample, hasMissingWeeks, uploadedFile, load, loadSample]);

  const selectedHP = useMemo(
    () => buildSlots(groups, selected).map((s) => s.maHP),
    [groups, selected]
  );

  const executeGA = useCallback(
    async (optToUse: SortOption, shouldPushWindow: boolean) => {
      if (!selected.length) {
        setToast({ msg: 'Hãy chọn ít nhất một học phần.', type: 'error' });
        return;
      }
      setProgress(0);
      const { solutions: nextSolutions } = await runGA(groups, selected, constraints, {
        sortOption: optToUse,
        onProgress: (g, t) => setProgress(Math.round((g / t) * 100)),
      });
      setSolutions(nextSolutions);
      setProgress(null);

      if (shouldPushWindow && nextSolutions.length > 0) {
        pushCanvasWindow();
      }

      const ok = nextSolutions.filter((s) => !s.conflicts && !s.violations).length;
      setToast(
        ok
          ? {
              msg: `Tìm được ${ok} phương án hợp lệ (ưu tiên: ${SORT_OPTION_LABELS[optToUse]})!`,
              type: 'success',
            }
          : {
              msg: 'Không có phương án nào hoàn toàn hợp lệ – hiển thị phương án ít lỗi nhất.',
              type: 'error',
            }
      );
    },
    [groups, selected, constraints, pushCanvasWindow]
  );

  const handleSortOptionChange = useCallback(
    (nextOpt: SortOption) => {
      setSortOption(nextOpt);
      if (selected.length > 0 && solutions.length > 0) {
        executeGA(nextOpt, false);
      }
    },
    [selected.length, solutions.length, executeGA]
  );

  const handleClearCache = useCallback(() => {
    clearCachedSession();
    setFileName(null);
    setIsSample(false);
    setUploadedFile(null);
    setRawRows([]);
    setSelected([]);
    setConstraints(emptyConstraints());
    setSortOption('random');
    setSolutions([]);
    setView('setup');
    setToast({ msg: 'Đã xóa toàn bộ dữ liệu cache của phiên trước.', type: 'success' });
  }, []);

  return (
    <div className="min-h-screen bg-grey-100 text-grey-800">
      <Navbar />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={closeToast} />}

      {view === 'setup' ? (
        /* MÀN HÌNH 1: CẤU HÌNH & CHỌN HỌC PHẦN */
        <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
          {fileName && (
            <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-info-dark bg-info-lighter px-4 py-2 text-xs font-semibold text-info-darker">
              <span>
                💾 Dữ liệu học phần & lựa chọn của bạn được tự động lưu trên trình duyệt.
              </span>
              <button
                type="button"
                onClick={handleClearCache}
                className="font-bold text-error-dark underline underline-offset-2 hover:text-error-darker"
              >
                🗑 Xóa dữ liệu đã lưu
              </button>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div className="space-y-5">
              <FileUploader
                fileName={fileName}
                courseCount={groups.length}
                onFile={onFile}
                onSample={() => loadSample(true)}
              />
              <CourseSelector groups={groups} selected={selected} setSelected={setSelected} />
            </div>

            <div className="space-y-5">
              <ConstraintsConfig value={constraints} onChange={setConstraints} />

              {/* Bước 4: Chọn tiêu chí ưu tiên trước khi xếp */}
              <section className="card-tactile">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="step-badge" aria-hidden="true">
                    4
                  </span>
                  <h2 className="text-base font-bold text-grey-800">
                    Tiêu chí ưu tiên sắp xếp kết quả
                  </h2>
                </div>
                <p className="mb-3 text-xs font-medium text-grey-600">
                  Chọn tiêu chí bạn muốn ưu tiên (có thể đổi lại bất kỳ lúc nào ở màn hình kết quả).
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {SORT_OPTIONS.map((opt) => {
                    const active = opt === sortOption;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSortOption(opt)}
                        className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-xs font-bold transition-all duration-150 ease-spring ${
                          active
                            ? 'border-primary-darker bg-primary-lighter text-primary-darker shadow-tactile-primary-sm'
                            : 'border-grey-300 bg-white text-grey-700 hover:bg-grey-50'
                        }`}
                      >
                        <span className="w-3.5 text-center font-extrabold">
                          {active ? '✓' : ''}
                        </span>
                        <span className="truncate">{SORT_OPTION_LABELS[opt]}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Cụm nút hành động chính */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => executeGA(sortOption, true)}
                  disabled={progress !== null || !groups.length}
                  className="btn-tactile-primary relative overflow-hidden"
                >
                  {progress !== null && (
                    <span
                      aria-hidden="true"
                      className="progress-striped animate-stripes absolute inset-y-0 left-0 bg-primary-dark/60 transition-[width] duration-150 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  <span className="relative z-10 tabular-nums">
                    {progress !== null
                      ? `🧬 Đang tối ưu… ${progress}%`
                      : '🧬 Xếp thời khóa biểu & Mở màn hình kết quả →'}
                  </span>
                </button>

                {solutions.length > 0 && (
                  <button
                    type="button"
                    onClick={pushCanvasWindow}
                    className="btn-tactile-info w-full"
                  >
                    🗓 Xem lại màn hình kết quả TKB vừa xếp ({solutions.length} phương án) →
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* MÀN HÌNH 2 (WINDOW MỚI): HIỂN THỊ LƯỚI THỜI KHÓA BIỂU TOÀN MÀN HÌNH */
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <TimetableCanvas
            solutions={solutions}
            groups={groups}
            selectedHP={selectedHP}
            sortOption={sortOption}
            onChangeSortOption={handleSortOptionChange}
            onBack={backToSetupWindow}
            selected={selected}
            setSelected={setSelected}
            constraints={constraints}
            setConstraints={setConstraints}
            onReRun={() => executeGA(sortOption, false)}
            isRunning={progress !== null}
          />
        </main>
      )}
    </div>
  );
}
