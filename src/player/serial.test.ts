import { describe, expect, it } from "vitest";
import { Serial } from "./serial";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("Serial", () => {
  it("exécute les tâches l'une après l'autre, dans l'ordre", async () => {
    const s = new Serial();
    const log: string[] = [];
    let release!: () => void;
    const first = s.run(async () => {
      log.push("a:start");
      await new Promise<void>((r) => (release = r));
      log.push("a:end");
    });
    const second = s.run(async () => {
      log.push("b");
    });
    await tick();
    expect(log).toEqual(["a:start"]);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(["a:start", "a:end", "b"]);
  });

  it("une tâche qui échoue ne bloque pas la suivante", async () => {
    const s = new Serial();
    await expect(s.run(async () => Promise.reject(new Error("boum")))).rejects.toThrow("boum");
    await expect(s.run(async () => "ok")).resolves.toBe("ok");
  });
});
