export interface PageResult<T> {
  items: T[];
  next: string | null;
}

export interface PaginationResult<T> {
  items: T[];
  pages: number;
}

export async function paginate<T>(options: {
  first: string;
  maxPages: number;
  idOf: (item: T) => string | null;
  fetchPage: (cursor: string, pageNumber: number) => Promise<PageResult<T>>;
  delay?: () => Promise<void>;
}): Promise<PaginationResult<T>> {
  const seenCursors = new Set<string>();
  const seenIds = new Set<string>();
  const items: T[] = [];
  let cursor: string | null = options.first;
  let pages = 0;

  while (cursor && pages < options.maxPages) {
    if (seenCursors.has(cursor)) break;
    seenCursors.add(cursor);
    if (pages > 0 && options.delay) await options.delay();

    const page = await options.fetchPage(cursor, pages + 1);
    pages += 1;
    if (page.items.length === 0) break;

    let newIds = 0;
    for (const item of page.items) {
      const id = options.idOf(item);
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      items.push(item);
      newIds += 1;
    }
    if (newIds === 0) break;
    cursor = page.next;
  }

  return { items, pages };
}
