import type { TimeConstraints } from '../types/timetable';

const DAYS = [2, 3, 4, 5, 6, 7, 8];
export const emptyConstraints = (): TimeConstraints =>
  Object.fromEntries(DAYS.map((d) => [d, { sang: false, chieu: false }])) as TimeConstraints;

export default function ConstraintsConfig({
  value,
  onChange,
}: {
  value: TimeConstraints;
  onChange: (c: TimeConstraints) => void;
}) {
  const toggle = (d: number, k: 'sang' | 'chieu') =>
    onChange({ ...value, [d]: { ...value[d], [k]: !value[d][k] } });

  const blockedCount = DAYS.reduce(
    (sum, d) => sum + (value[d]?.sang ? 1 : 0) + (value[d]?.chieu ? 1 : 0),
    0
  );

  const isWeekendOff =
    value[7]?.sang && value[7]?.chieu && value[8]?.sang && value[8]?.chieu;

  const toggleWeekend = () => {
    const next = !isWeekendOff;
    onChange({
      ...value,
      7: { sang: next, chieu: next },
      8: { sang: next, chieu: next },
    });
  };

  return (
    <section className="card-tactile">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="step-badge" aria-hidden="true">3</span>
          <h2 className="text-base font-bold text-grey-800">Khung giờ muốn nghỉ</h2>
        </div>
        {blockedCount > 0 && (
          <span className="badge-error tabular-nums">Đã khóa {blockedCount} buổi</span>
        )}
      </div>
      <p className="mb-3 text-xs font-medium text-grey-600">
        Bấm chọn các buổi muốn nghỉ cố định — thuật toán sẽ tránh xếp lớp vào đó.
      </p>

      {/* Nút chọn nhanh tiện lợi */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleWeekend}
          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border-2 px-2.5 py-1 text-xs font-bold transition-all duration-150 ease-spring active:translate-y-[2px] ${
            isWeekendOff
              ? 'border-error-dark bg-error-lighter text-error-darker shadow-tactile-error-sm'
              : 'border-grey-300 bg-grey-50 text-grey-700 shadow-tactile-grey-sm hover:bg-grey-100'
          }`}
        >
          <span>{isWeekendOff ? '✓' : '🏖'}</span>
          <span>Nghỉ cuối tuần (T7, CN)</span>
        </button>
        {blockedCount > 0 && (
          <button
            type="button"
            onClick={() => onChange(emptyConstraints())}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border-2 border-grey-300 bg-white px-2.5 py-1 text-xs font-bold text-grey-700 shadow-tactile-grey-sm transition-all duration-150 ease-spring hover:bg-grey-100 active:translate-y-[2px]"
          >
            ↺ Bỏ chọn hết
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center text-sm">
          <thead>
            <tr className="text-xs font-bold text-grey-600">
              <th className="w-12 text-left">Buổi</th>
              {DAYS.map((d) => (
                <th key={d} className="pb-1">
                  {d === 8 ? 'CN' : `T${d}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['sang', 'chieu'] as const).map((k) => {
              const isSang = k === 'sang';
              return (
                <tr key={k}>
                  <td className="pr-1 text-left text-xs font-bold text-grey-700">
                    {isSang ? 'Sáng' : 'Chiều'}
                  </td>
                  {DAYS.map((d) => {
                    const active = value[d][k];
                    const dayLabel = d === 8 ? 'Chủ nhật' : `Thứ ${d}`;
                    return (
                      <td key={d}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active}
                          aria-label={`Nghỉ buổi ${isSang ? 'Sáng' : 'Chiều'} ${dayLabel}`}
                          onClick={() => toggle(d, k)}
                          className={`inline-flex h-11 w-11 select-none items-center justify-center rounded-xl border-2 text-sm font-bold transition-all duration-150 ease-spring ${
                            active
                              ? 'translate-y-[2px] border-error-dark bg-error-lighter text-error-darker shadow-tactile-error-sm active:translate-y-[4px] active:shadow-tactile-none'
                              : 'border-grey-300 bg-white text-grey-400 shadow-tactile-grey-md hover:border-grey-400 hover:bg-grey-100 active:translate-y-[4px] active:shadow-tactile-none'
                          }`}
                        >
                          {active ? (isSang ? '☕' : '🌙') : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2.5 text-center text-xs font-medium tabular-nums text-grey-600">
        ☕ Sáng &lt; 12:00 · 🌙 Chiều 12:00–18:00
      </p>
    </section>
  );
}
