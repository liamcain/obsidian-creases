export function hasFold(text: string): boolean {
  return /%%\s+fold\s+%%/.test(text);
}
