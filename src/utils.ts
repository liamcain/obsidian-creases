export function hasCrease(text: string): boolean {
  return /%%\s+fold\s+%%/.test(text);
}
