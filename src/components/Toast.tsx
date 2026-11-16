import { useEffect } from 'react';

export default function Toast({
  message,
  type = 'success',
  onClose,
}: {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  const isSuccess = type === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`no-print fixed inset-x-4 top-4 z-50 flex animate-toast-in items-center gap-3 rounded-card border-2 px-4 py-3 sm:inset-x-auto sm:right-4 sm:max-w-md ${
        isSuccess
          ? 'border-success-dark bg-success-lighter text-success-darker shadow-tactile-success-lg'
          : 'border-error-dark bg-error-lighter text-error-darker shadow-tactile-error-lg'
      }`}
    >
      <span className="text-lg shrink-0" aria-hidden="true">
        {isSuccess ? '✅' : '⚠️'}
      </span>
      <span className="flex-1 text-sm font-bold leading-snug">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-current/30 text-xs font-bold transition-transform duration-150 ease-spring hover:scale-105 active:translate-y-[2px]"
      >
        ✕
      </button>
    </div>
  );
}
