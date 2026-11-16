export default function Navbar() {
  return (
    <header className="no-print border-b-2 border-primary-darker bg-gradient-to-r from-primary-main to-primary-dark text-white shadow-tactile-primary-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary-darker bg-white px-2.5 py-1.5 shadow-tactile-primary-sm">
            <img
              src="/LogoHeader.png"
              alt="Logo HUCE"
              className="h-full w-auto object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-white">
              HUCE Timetable Scheduler
            </h1>
            <p className="truncate text-xs font-medium text-primary-lighter">
              Công cụ xếp thời khóa biểu tự động bằng Thuật toán Di truyền (GA)
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border-2 border-primary-darker bg-primary-lighter px-3 py-1 text-xs font-bold text-primary-darker shadow-tactile-primary-sm">
          🧬 Kỳ 20261 · Tuần 1: 11/01/2027
        </span>
      </div>
    </header>
  );
}
