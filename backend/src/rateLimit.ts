export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  get available(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  get full(): boolean {
    this.refill();
    return this.tokens >= this.capacity;
  }

  take(): boolean {
    if (!this.available) return false;
    this.tokens -= 1;
    return true;
  }

  private refill(): void {
    const now = this.now();
    const elapsed = Math.max(0, now - this.updatedAt);
    this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.refillPerSecond);
    this.updatedAt = now;
  }
}

/** One bucket per key. Call `prune` now and then to forget idle keys. */
export class KeyedLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.buckets.size;
  }

  available(key: string): boolean {
    return this.buckets.get(key)?.available ?? true;
  }

  take(key: string): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerSecond, this.now);
      this.buckets.set(key, bucket);
    }
    return bucket.take();
  }

  prune(): void {
    for (const [key, bucket] of this.buckets) if (bucket.full) this.buckets.delete(key);
  }
}
