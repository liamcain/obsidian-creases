export const CREASE_REGEX = /%%\s+fold\s+%%/;

export function hasCrease(text: string): boolean {
  return CREASE_REGEX.test(text);
}
