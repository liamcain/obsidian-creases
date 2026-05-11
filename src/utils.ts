export const CREASE_REGEX = /%% +fold +%%/;

export function hasCrease(text: string): boolean {
  return CREASE_REGEX.test(text);
}

export function sortBy<T>(items: readonly T[], keys: readonly (keyof T)[]): T[] {
  return [...items].sort((a, b) => {
    for (const key of keys) {
      if (a[key] < b[key]) return -1;
      if (a[key] > b[key]) return 1;
    }
    return 0;
  });
}
