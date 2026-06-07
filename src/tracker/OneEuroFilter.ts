// 🔒 4.1 OneEuroFilter (verbatim — Casiez 2012). DO NOT change the constants.
// mincutoff = 1.0, beta = 0.007 are LAW. Speed-adaptive low-pass: low cutoff at
// rest (kills jitter), opens up during fast motion.

class LowPassFilter {
  private y: number | null = null;
  filter(x: number, alpha: number): number {
    const y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    this.y = y;
    return y;
  }
  lastRawValue() {
    return this.y;
  }
  setLastRawValue(v: number) {
    this.y = v;
  }
}

export class OneEuroFilter {
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;
  constructor(
    private mincutoff = 1.0,
    private beta = 0.007,
    private dcutoff = 1.0
  ) {}
  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(x: number, timestamp: number): number {
    const dt =
      this.lastTime === null ? 1 / 30 : (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const prev = this.xFilter.lastRawValue() ?? x;
    const dx = (x - prev) / dt;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dcutoff, dt));
    const cutoff = this.mincutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this.alpha(cutoff, dt));
  }
  reset() {
    this.xFilter.setLastRawValue(null as unknown as number);
    this.dxFilter.setLastRawValue(null as unknown as number);
    this.lastTime = null;
  }
}
