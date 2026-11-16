import { useEffect, useMemo, useRef, useState } from 'react';
import type { CourseGroup, SelectedCourseConfig } from '../types/timetable';
import { formatWeeks } from '../utils/excelParser';

interface Props {
  groups: CourseGroup[];
  selected: SelectedCourseConfig[];
  setSelected: (s: SelectedCourseConfig[]) => void;
}

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dayName = (d: number) => (d === 8 ? 'CN' : `T${d}`);

export default function CourseSelector({ groups, selected, setSelected }: Props) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [secQ, setSecQ] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return [];
    return groups
      .filter(
        (g) =>
          !selected.some((s) => s.maHP === g.maHP) &&
          (g.maHP.toLowerCase().includes(k) || g.tenHP.toLowerCase().includes(k))
      )
      .slice(0, 8);
  }, [q, groups, selected]);

  const add = (g: CourseGroup) => {
    setSelected([...selected, { maHP: g.maHP, selectedSectionIds: [] }]);
    setQ('');
  };
  const remove = (maHP: string) => setSelected(selected.filter((s) => s.maHP !== maHP));
  const editGroup = groups.find((g) => g.maHP === editing);
  const editCfg = selected.find((s) => s.maHP === editing);

  const setIds = (ids: string[]) =>
    setSelected(selected.map((s) => (s.maHP === editing ? { ...s, selectedSectionIds: ids } : s)));
  const allIds = editGroup?.sections.map((s) => s.id) ?? [];
  const isAll =
    !editCfg ||
    editCfg.selectedSectionIds.length === 0 ||
    editCfg.selectedSectionIds.length === allIds.length;
  const checked = (id: string) => isAll || editCfg!.selectedSectionIds.includes(id);
  const toggle = (id: string) => {
    const cur = isAll ? allIds : editCfg!.selectedSectionIds;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setIds(next.length === allIds.length ? [] : next);
  };

  // Accessibility: đóng bằng Esc & focus trap trong Modal (4.8)
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(null);
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing]);

  const filteredSections = useMemo(() => {
    if (!editGroup) return [];
    const k = secQ.trim().toLowerCase();
    if (!k) return editGroup.sections;
    return editGroup.sections.filter((sec) =>
      (sec.id + ' ' + sec.sessions.map((x) => x.ghiChu).join(' ')).toLowerCase().includes(k)
    );
  }, [editGroup, secQ]);

  return (
    <section className="card-tactile">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="step-badge" aria-hidden="true">2</span>
          <h2 className="text-base font-bold text-grey-800">Chọn học phần</h2>
        </div>
        {selected.length > 0 && (
          <span className="badge-info tabular-nums">{selected.length} môn</span>
        )}
      </div>

      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!groups.length}
          aria-label="Tìm kiếm học phần theo Mã HP hoặc Tên HP"
          placeholder={groups.length ? '🔎 Tìm theo Mã HP hoặc Tên HP...' : 'Hãy tải dữ liệu trước'}
          className="input-tactile"
        />
        {results.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-30 mt-2 max-h-64 w-full animate-pop-in overflow-auto rounded-card border-2 border-grey-300 bg-white p-1.5 shadow-tactile-card"
          >
            {results.map((g) => (
              <li key={g.maHP}>
                <button
                  type="button"
                  onClick={() => add(g)}
                  className="row-hover-grey flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors"
                >
                  <span className="min-w-0 truncate">
                    <b className="font-bold tabular-nums text-primary-darker">{g.maHP}</b>
                    <span className="text-grey-800"> – {g.tenHP}</span>
                  </span>
                  <span className="badge-neutral shrink-0 tabular-nums">
                    +{g.sections.length} lớp
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="mt-3 space-y-2.5">
        {selected.length === 0 && (
          <li className="rounded-2xl border-2 border-dashed border-grey-300 bg-grey-100 px-3 py-4 text-center text-xs font-medium text-grey-600">
            Chưa có học phần nào trong danh sách chọn.
          </li>
        )}
        {selected.map((s) => {
          const g = groups.find((x) => x.maHP === s.maHP);
          if (!g) return null;
          const n = s.selectedSectionIds.length || g.sections.length;
          return (
            <li
              key={s.maHP}
              className="animate-pop-in flex items-center justify-between gap-2 rounded-2xl border-2 border-grey-300 bg-grey-50 p-2.5 shadow-tactile-grey-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-grey-800">{g.tenHP}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium tabular-nums text-grey-600">
                  <span className="font-bold text-grey-700">#{g.maHP}</span>
                  <span>·</span>
                  <span className="badge-info px-2 py-0.5 text-[11px] tabular-nums">
                    {n}/{g.sections.length} lớp
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Chọn lớp cho học phần ${g.tenHP}`}
                  onClick={() => {
                    setSecQ('');
                    setEditing(s.maHP);
                  }}
                  className="btn-icon-info"
                >
                  <span aria-hidden="true">⚙</span>
                  <span>Chọn lớp</span>
                </button>
                <button
                  type="button"
                  aria-label={`Xóa học phần ${g.tenHP}`}
                  onClick={() => remove(s.maHP)}
                  className="btn-icon-danger"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editGroup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/[0.48] p-0 sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-course-title"
            className="animate-pop-in flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-card border-2 border-grey-300 bg-white shadow-tactile-card sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-grey-300 bg-grey-100 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h3 id="modal-course-title" className="truncate text-base font-bold text-grey-800">
                  {editGroup.tenHP}
                </h3>
                <p className="text-xs font-medium tabular-nums text-grey-600">
                  Mã HP: <b className="text-grey-800">{editGroup.maHP}</b> · {editGroup.sections.length} lớp đang mở
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng cửa sổ chọn lớp"
                onClick={() => setEditing(null)}
                className="btn-icon-danger"
              >
                ✕
              </button>
            </div>

            {/* Filter & Quick Actions */}
            <div className="space-y-2.5 border-b-2 border-grey-300 bg-white px-4 py-3 sm:px-5">
              <input
                value={secQ}
                onChange={(e) => setSecQ(e.target.value)}
                aria-label="Lọc theo mã lớp hoặc ghi chú khóa"
                placeholder="🔎 Lọc theo mã lớp / ghi chú khóa (vd: 65, XD-HCM)..."
                className="input-tactile"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIds([])}
                  className="btn-tactile-success px-3 py-1.5 text-xs"
                >
                  ✅ Chọn tất cả ({allIds.length})
                </button>
                {secQ.trim() && filteredSections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIds(filteredSections.map((x) => x.id))}
                    className="btn-tactile-info px-3 py-1.5 text-xs"
                  >
                    🎯 Chỉ chọn lớp đang lọc ({filteredSections.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIds([allIds[0]])}
                  className="btn-tactile-neutral px-3 py-1.5 text-xs"
                >
                  Bỏ chọn (giữ 1)
                </button>
              </div>
            </div>

            {/* Section List */}
            <ul className="flex-1 divide-y-2 divide-grey-200 overflow-y-auto px-2 py-1">
              {filteredSections.map((sec) => {
                const isChecked = checked(sec.id);
                return (
                  <li key={sec.id}>
                    <label className="row-hover-grey flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(sec.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 text-xs font-bold transition-all duration-150 ease-spring ${
                          isChecked
                            ? 'border-primary-darker bg-primary-main text-white shadow-tactile-primary-sm'
                            : 'border-grey-300 bg-white text-transparent shadow-tactile-grey-sm'
                        }`}
                      >
                        ✓
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-bold tabular-nums text-grey-800">Lớp {sec.id}</div>
                        <div className="mt-1 space-y-0.5">
                          {sec.sessions.map((x, i) => (
                            <div
                              key={i}
                              className="text-xs font-medium tabular-nums text-grey-600"
                            >
                              {sec.sessions.length > 1 && (
                                <span className="mr-1 rounded bg-grey-200 px-1 py-0.5 text-[10px] font-bold text-grey-700">
                                  Buổi {x.buoiSo ?? i + 1}
                                </span>
                              )}
                              <b className="text-grey-800">{dayName(x.thu)}</b> · {fmt(x.timeStartMinutes)}–{fmt(x.timeEndMinutes)} · Tuần{' '}
                              <b className="text-secondary-dark">{formatWeeks(x.tuanHoc, x.tuanRaw)}</b>
                              {x.phong ? ` · ${x.phong}` : ''}
                              {x.ghiChu ? ` · ${x.ghiChu}` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="flex items-center justify-between border-t-2 border-grey-300 bg-grey-100 px-4 py-3 sm:px-5">
              <span className="text-xs font-bold tabular-nums text-grey-700">
                Đang bật: {isAll ? allIds.length : editCfg?.selectedSectionIds.length ?? 0}/{allIds.length} lớp
              </span>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-tactile-primary-md px-5"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
