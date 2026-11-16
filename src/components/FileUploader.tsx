import { useRef, useState } from 'react';

interface Props {
  fileName: string | null;
  courseCount?: number;
  onFile: (f: File) => void;
  onSample: () => void;
}

export default function FileUploader({ fileName, courseCount = 0, onFile, onSample }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <section className="card-tactile">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="step-badge" aria-hidden="true">1</span>
        <h2 className="text-base font-bold text-grey-800">Tải dữ liệu thời khóa biểu</h2>
      </div>

      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />

      {fileName ? (
        <div className="animate-pop-in rounded-2xl border-2 border-success-dark bg-success-lighter p-3.5 text-success-darker shadow-tactile-success-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold" title={fileName}>
                📄 {fileName}
              </div>
              {courseCount > 0 && (
                <div className="mt-0.5 text-xs font-medium tabular-nums">
                  ✅ Đã đọc {courseCount} học phần
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="btn-tactile-info shrink-0 px-3 py-1.5 text-xs"
            >
              📁 Đổi file
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className={`flex min-h-[76px] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-3 text-sm font-semibold transition-all duration-150 ease-spring active:translate-y-[2px] ${
              dragging
                ? 'border-info-main bg-info-lighter text-info-darker'
                : 'border-grey-400 bg-grey-50 text-grey-700 hover:border-info-main hover:bg-info-lighter hover:text-info-darker'
            }`}
          >
            <span className="text-xl" aria-hidden="true">📁</span>
            <span>Kéo-thả hoặc bấm chọn file .xlsx / .xls / .csv</span>
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-grey-600">Chưa có file Excel?</span>
        <button
          type="button"
          onClick={onSample}
          className="text-xs font-bold text-info-dark underline decoration-2 underline-offset-2 transition-colors hover:text-info-darker"
        >
          ✨ Dùng dữ liệu mẫu
        </button>
      </div>
    </section>
  );
}
