import type {
  RawCourseRow,
  SelectedCourseConfig,
  Solution,
  SortOption,
  TimeConstraints,
} from '../types/timetable';

const STATE_KEY = 'huce_tkb_session_v1';
const DB_NAME = 'huce_tkb_db';
const STORE_NAME = 'datasets';
const ROWS_KEY = 'raw_rows_v1';

export interface CachedSession {
  fileName: string | null;
  isSample: boolean;
  selected: SelectedCourseConfig[];
  constraints?: TimeConstraints;
  sortOption?: SortOption;
  solutions: Solution[];
  view?: 'setup' | 'canvas';
}

export function loadCachedSession(): CachedSession | null {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      fileName: typeof parsed.fileName === 'string' ? parsed.fileName : null,
      isSample: Boolean(parsed.isSample),
      selected: Array.isArray(parsed.selected) ? parsed.selected : [],
      constraints: parsed.constraints,
      sortOption: parsed.sortOption,
      solutions: Array.isArray(parsed.solutions) ? parsed.solutions : [],
      view: parsed.view === 'canvas' ? 'canvas' : 'setup',
    };
  } catch {
    return null;
  }
}

export function saveCachedSession(session: CachedSession): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(session));
  } catch {
    // Bỏ qua nếu trình duyệt chặn storage hoặc đầy quota
  }
}

export function clearCachedSession(): void {
  try {
    window.localStorage.removeItem(STATE_KEY);
  } catch {
    // ignore
  }
  saveCachedRows([]).catch(() => {});
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCachedRows(rows: RawCourseRow[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (rows.length === 0) {
        store.delete(ROWS_KEY);
      } else {
        store.put(rows, ROWS_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function loadCachedRows(): Promise<RawCourseRow[]> {
  try {
    const db = await openDB();
    const rows = await new Promise<RawCourseRow[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ROWS_KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as RawCourseRow[]) : []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows;
  } catch {
    return [];
  }
}
