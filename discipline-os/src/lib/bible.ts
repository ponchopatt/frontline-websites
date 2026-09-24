/** The 66 books with their chapter counts, in canonical order. */
export const BOOKS: ReadonlyArray<readonly [name: string, chapters: number]> = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34],
  ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10],
  ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
  ["Ecclesiastes", 12], ["Song of Songs", 8], ["Isaiah", 66], ["Jeremiah", 52],
  ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3],
  ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3],
  ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28], ["Romans", 16],
  ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6], ["Ephesians", 6],
  ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3],
  ["1 Timothy", 6], ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13],
  ["James", 5], ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1], ["3 John", 1],
  ["Jude", 1], ["Revelation", 22],
];

export const BOOK_NAMES = BOOKS.map(([name]) => name);

export function chaptersIn(book: string): number | null {
  const found = BOOKS.find(([name]) => name === book);
  return found ? found[1] : null;
}

export interface ReadingRef {
  book: string;
  chapter: number;
}

/** Where a first-time reader starts. */
export const FIRST_READING: ReadingRef = { book: "John", chapter: 1 };

/** The chapter after `ref`, rolling into the next book and back to Genesis after Revelation. */
export function nextReading(ref: ReadingRef): ReadingRef {
  const index = BOOKS.findIndex(([name]) => name === ref.book);
  if (index === -1) return FIRST_READING;
  const [, chapters] = BOOKS[index];
  if (ref.chapter < chapters) return { book: ref.book, chapter: ref.chapter + 1 };
  const [nextBook] = BOOKS[(index + 1) % BOOKS.length];
  return { book: nextBook, chapter: 1 };
}

export function formatReading(ref: ReadingRef, passage?: string | null): string {
  return passage ? `${ref.book} ${ref.chapter}:${passage}` : `${ref.book} ${ref.chapter}`;
}

/** Simple reading plans: a list of books read a chapter a day, from where you are. */
export const PLANS = {
  bible: { label: "Whole Bible", books: BOOK_NAMES },
  new_testament: { label: "New Testament", books: BOOK_NAMES.slice(BOOK_NAMES.indexOf("Matthew")) },
  gospels: { label: "The Gospels", books: ["Matthew", "Mark", "Luke", "John"] },
  psalms_proverbs: { label: "Psalms and Proverbs", books: ["Psalms", "Proverbs"] },
} as const;
export type PlanKey = keyof typeof PLANS;

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in PLANS;
}

/**
 * Today's chapter on a plan: the one after the last chapter read, if that was on the plan
 * (wrapping round at the end); otherwise the plan's first chapter. The whole-Bible plan starts
 * a first-time reader at John 1.
 */
export function nextInPlan(plan: PlanKey, last: ReadingRef | null): ReadingRef {
  const books: readonly string[] = PLANS[plan].books;
  if (!last || !books.includes(last.book)) {
    return plan === "bible" ? (last ? nextReading(last) : FIRST_READING) : { book: books[0], chapter: 1 };
  }
  const chapters = chaptersIn(last.book) ?? 1;
  if (last.chapter < chapters) return { book: last.book, chapter: last.chapter + 1 };
  const next = books[(books.indexOf(last.book) + 1) % books.length];
  return { book: next, chapter: 1 };
}
