export const CREASE_REGEX = /%% +fold +%%/;

export function hasCrease(text: string): boolean {
  return CREASE_REGEX.test(text);
}
