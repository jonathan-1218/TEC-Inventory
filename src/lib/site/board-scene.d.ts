export function initBoard(
  box: HTMLElement,
  fonts: { mono: string; display: string },
): { update(p: number, mx: number, my: number, now: number): void; dispose(): void };
