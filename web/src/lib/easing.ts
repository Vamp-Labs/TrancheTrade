function bezierComponent(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

function bezierSlope(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return (3 * a * t + 2 * b) * t + c;
}

export function cubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (progress: number) => number {
  return (progress: number): number => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let guess = progress;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const error = bezierComponent(guess, x1, x2) - progress;
      if (Math.abs(error) < 1e-6) break;
      const slope = bezierSlope(guess, x1, x2);
      if (Math.abs(slope) < 1e-6) break;
      guess -= error / slope;
    }
    return bezierComponent(Math.min(Math.max(guess, 0), 1), y1, y2);
  };
}

export const beatEasing = cubicBezierEasing(0.16, 1, 0.3, 1);

export function interpolateBigint(from: bigint, to: bigint, easedProgress: number): bigint {
  const scale = 1_000_000n;
  const clamped = Math.min(Math.max(easedProgress, 0), 1);
  const numerator = BigInt(Math.round(clamped * 1_000_000));
  return from + ((to - from) * numerator) / scale;
}
