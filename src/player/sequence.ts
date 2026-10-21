/** Garde contre les résultats périmés : seule la dernière demande compte. */
export class Sequence {
  private current = 0;

  next(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(n: number): boolean {
    return n !== 0 && n === this.current;
  }
}
