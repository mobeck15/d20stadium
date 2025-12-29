import type { Monster } from "./monster.js";
import type MonsterState from "./monsterState.js";
import { rollDice } from "./dice.js";
import type { HandlerContext } from "./specialHandlers.js";

export function mulberry32(a: number): () => number {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function rollInitiative(
  monster: Monster,
  random: () => number
): number {
  return Math.floor(random() * 20) + 1 + monster.initiative;
}

export function resolveAttack(
  attacker: Monster,
  defender: Monster,
  attackerState: MonsterState,
  defenderState: MonsterState,
  attack: { name: string; damage: string; bonus?: number },
  random: () => number
): { isHit: boolean; damage: number; rolls: { base1: number; base2: number | null; chosen: number } } {
  const attackPenalty = attackerState.getAttackPenalty();
  const defenderHasAdv = defenderState.statuses.some((s) => s.advantageAgainst);
  
  const base1 = Math.floor(random() * 20) + 1;
  let base2: number | null = null;
  let chosenBase = base1;
  
  if (defenderHasAdv) {
    base2 = Math.floor(random() * 20) + 1;
    chosenBase = Math.max(base1, base2);
  }
  
  const attackRoll = chosenBase + (attack.bonus ?? attacker.attack_bonus) + attackPenalty;
  const isHit = attackRoll >= defender.ac;
  const damage = isHit ? rollDice(attack.damage, random) : 0;
  
  return {
    isHit,
    damage,
    rolls: { base1, base2, chosen: chosenBase }
  };
}

export function createHandlerContext(
  a: Monster,
  b: Monster,
  attackerState: MonsterState,
  defenderState: MonsterState,
  attacker: Monster,
  defender: Monster,
  attackerLabel: string,
  defenderLabel: string,
  random: () => number,
  debug: boolean
): HandlerContext {
  return {
    a,
    b,
    attackerState,
    defenderState,
    attacker,
    defender,
    attackerLabel,
    defenderLabel,
    random,
    debug,
  } as HandlerContext;
}
