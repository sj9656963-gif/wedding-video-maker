// 작은 DOM 도우미

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 요소를 찾을 수 없어요.`);
  return el as T;
}

type Props = {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.on) {
    for (const [type, fn] of Object.entries(props.on)) el.addEventListener(type, fn as EventListener);
  }
  for (const c of children) el.append(c);
  return el;
}

/** 상태 표시줄 문구 설정 */
export function setStatus(el: HTMLElement, text: string, kind: '' | 'ok' | 'warn' | 'err' = ''): void {
  el.textContent = text;
  el.className = `status${kind ? ` ${kind}` : ''}`;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** 드롭된 항목에서 파일을 모두 꺼냄 (폴더를 끌어다 놓은 경우 하위 파일까지) */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  const plain: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== 'file') continue;
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
    else {
      const f = item.getAsFile();
      if (f) plain.push(f);
    }
  }
  if (entries.length === 0) return plain.length ? plain : Array.from(dt.files ?? []);

  const out: File[] = [...plain];
  const readFile = (e: FileSystemFileEntry) => new Promise<File | null>((res) => e.file(res, () => res(null)));
  const readAll = (dir: FileSystemDirectoryEntry) =>
    new Promise<FileSystemEntry[]>((res) => {
      const reader = dir.createReader();
      const acc: FileSystemEntry[] = [];
      const next = () =>
        reader.readEntries(
          (batch) => {
            if (batch.length === 0) res(acc);
            else {
              acc.push(...batch);
              next();
            }
          },
          () => res(acc),
        );
      next();
    });
  const walk = async (entry: FileSystemEntry, depth: number): Promise<void> => {
    if (entry.isFile) {
      const f = await readFile(entry as FileSystemFileEntry);
      if (f) out.push(f);
    } else if (entry.isDirectory && depth < 6) {
      for (const child of await readAll(entry as FileSystemDirectoryEntry)) await walk(child, depth + 1);
    }
  };
  for (const e of entries) await walk(e, 0);
  return out;
}
