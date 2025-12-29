import type { Monster } from "./monster.js";
import { rollDice } from "./dice.js";
import type MonsterState from "./monsterState.js";

export type StatusEffect = {
  name: string;
  duration: number; // rounds remaining
  attackPenalty?: number;
  savePenalty?: number;
  loseTurn?: boolean;
  advantageAgainst?: boolean;
  once?: boolean; // if true, status can only be applied once while active
  [key: string]: unknown;
};

export type HandlerContext = {
  a: Monster;
  b: Monster;
  attackerState: MonsterState;
  defenderState: MonsterState;
  attacker: Monster;
  defender: Monster;
  attackerLabel: string;
  defenderLabel: string;
  random: () => number;
  debug: boolean;
};

// Helper function for saving throws
export function performSave(
  ctx: HandlerContext,
  saveType: "fort" | "ref" | "will",
  dc: number
): { roll: number; pass: boolean } {
  const targetState = ctx.defenderState;
  const rollBase = Math.floor(ctx.random() * 20) + 1;
  const roll = rollBase + targetState.getSaveTotal(saveType);
  const pass = roll >= dc;
  return { roll, pass };
}

// Helper function for applying status effects
export function applyStatusByName(
  ctx: HandlerContext,
  target: 'attacker' | 'defender',
  name: string,
  duration: number,
  extra?: Partial<StatusEffect>
): string {
  const targetState = target === 'attacker' ? ctx.attackerState : ctx.defenderState;
  const effect: StatusEffect = { name, duration, ...extra };
  targetState.applyStatus(effect);
  const targetName = target === 'attacker' ? ctx.attackerLabel : ctx.defenderLabel;
  return `${targetName} gains status: ${name} (${duration} rounds)`;
}

export const specialHandlers: Record<
  string,
  Partial<{
    onTurnEnd: (ctx: HandlerContext, param?: unknown) => void;
    onTurnStart: (ctx: HandlerContext, param?: unknown) => void;
    onOpponentTurnStart: (ctx: HandlerContext, param?: unknown) => void;
    onHit: (ctx: HandlerContext, param?: unknown) => void;
    onFightStart: (ctx: HandlerContext, param?: unknown) => void;
  }>
> = {
  regeneration: {
    onTurnEnd(ctx, param) {
      const regen = Number(param || (ctx.attackerState.monster.special && (ctx.attackerState.monster.special as any).regeneration));
      if (!Number.isFinite(regen) || regen <= 0) return;
      const st = ctx.attackerState;
      if (st.hp > 0) {
        st.hp = Math.min(st.hp + regen, st.maxHp);
        if (ctx.debug) console.log(`${ctx.attackerLabel} regenerates ${regen} -> HP=${st.hp}`);
      }
    },
  },
  trip: {
    onHit(ctx, param) {
      const dc = (param && typeof param === 'object' && 'dc' in param) ? (param as any).dc : 12;
      const { roll, pass } = performSave(ctx, "fort", dc);
      let result = "";
      let logText = "";
      if (!pass) {
        const rounds = Number((param && (param as any).rounds) ?? (param === true ? 1 : Number(param) || 1));
        if (!Number.isFinite(rounds) || rounds <= 0) return;
        logText = applyStatusByName(ctx, 'defender', 'Prone', rounds, { attackPenalty: -4, advantageAgainst: true });
        result = `FAIL`;
      } else {
        result = `PASS`;
      }
      if (ctx.debug) {
        console.log(`${ctx.attackerLabel} trips ${ctx.defenderLabel} - ${ctx.defenderLabel} fort save roll ${roll} vs DC ${dc} ${result}`);
        if (logText) console.log(logText);
      }
    },
  },
  paralysis: {
    onHit(ctx, param) {
      const dc = (param && typeof param === 'object' && 'dc' in param) ? (param as any).dc : 15;
      const { roll, pass } = performSave(ctx, "fort", dc);
      let result = "";
      let logText = "";
      if (!pass) {
        const duration = rollDice("1d4+1", ctx.random);
        logText = applyStatusByName(ctx, 'defender', 'Paralyzed', duration, { loseTurn: true });
        result = `FAIL : ${duration} rounds`;
      } else {
        result = `PASS`;
      }

      if (ctx.debug) {
        console.log(`${ctx.attackerLabel} paralyze on hit - ${ctx.defenderLabel} fort save roll ${roll} vs DC ${dc} ${result}`);
        if (logText) console.log(logText);
      }
    },
  },
  stench: {
    onFightStart(ctx, param) {
      const dc = (param && typeof param === 'object' && 'dc' in param) ? (param as any).dc : 15;
      const { roll, pass } = performSave(ctx, "fort", dc);

      let result = "";
      let logText = "";
      if (!pass) {
        const base = rollDice("1d6+4", ctx.random);
        const duration = base * 10;
        logText = applyStatusByName(ctx, 'defender', 'Sickened', duration, { attackPenalty: -2, savePenalty: -2, once: true });
        result = `FAIL`;
      } else {
        logText = applyStatusByName(ctx, 'defender', 'StenchImmune', 14400);
        result = `PASS`;
      }

      if (ctx.debug) {
        console.log(`${ctx.attackerLabel} stench - ${ctx.defenderLabel} fort save roll ${roll} vs DC ${dc} ${result}`);
        console.log(logText);
      }
    }
  }
};

export default specialHandlers;
