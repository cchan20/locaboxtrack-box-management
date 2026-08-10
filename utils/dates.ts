export function getDaysOut(dateString: string | null, now: number = Date.now()): number {
  if (!dateString) {
    return 0;
  }

  const diff = now - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
