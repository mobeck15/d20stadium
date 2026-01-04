import type { Monster } from "./monster.js";
import type { StatusEffect } from "./specialHandlers.js";

export class MonsterState {
  monster: Monster;
  hp: number;
  maxHp: number;
  statuses: StatusEffect[] = [];
  damageDealt: number = 0;
  statusTotals: Map<string, number> = new Map();
  lastTarget?: { teamIndex: number; memberIndex: number; };
  damageReceivedFrom: Map<string, number> = new Map();

  constructor(monster: Monster) {
    this.monster = monster;
    this.hp = monster.hp;
    this.maxHp = monster.hp;
  }

  applyStatus(effect: StatusEffect) {
    if (!effect || !effect.name) return;
    const existing = this.statuses.find((s) => s.name === effect.name);
    if (existing) {
      // If the status is marked as once-only, do not re-apply while an active instance exists
      if (effect.once && existing.duration > 0) {
        return;
      }
      existing.duration = Math.max(existing.duration, effect.duration);
    } else {
      this.statuses.push({ ...effect });
    }
  }

  hasStatus(name: string): boolean {
    return this.statuses.some((s) => s.name === name && s.duration > 0);
  }

  getAttackPenalty(): number {
    return this.statuses.reduce((sum, s) => sum + (s.attackPenalty ?? 0), 0);
  }

  getSaveTotal(kind: "fort" | "ref" | "will"): number {
    const base = (this.monster.saves && (this.monster.saves as any)[kind]) ?? 0;
    const penalty = this.statuses.reduce((sum, s) => sum + (Number(s.savePenalty ?? 0)), 0);
    return base + penalty;
  }

  tickStatuses() {
    for (let i = this.statuses.length - 1; i >= 0; i--) {
      const s = this.statuses[i];
      if (!s) continue;
      if (s.duration > 0) {
        this.statusTotals.set(s.name, (this.statusTotals.get(s.name) || 0) + 1);
      }
      s.duration -= 1;
      if (s.duration <= 0) this.statuses.splice(i, 1);
    }
  }

  toDebug(): string {
    return this.statuses.length ? this.statuses.map((s) => `${s.name}(${s.duration})`).join(", ") : "none";
  }
}

export default MonsterState;
