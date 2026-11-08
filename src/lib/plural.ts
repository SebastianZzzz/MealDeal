// "1 portion", "2 portions". English only; pass the plural for irregular words.
export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`;
}
