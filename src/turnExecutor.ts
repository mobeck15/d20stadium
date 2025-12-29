import type { Monster } from "./monster.js";
import type MonsterState from "./monsterState.js";
import specialHandlers from "./specialHandlers.js";
import type { HandlerContext } from "./specialHandlers.js";

// export function executeTurn(
//   attacker: Monster,
//   defender: Monster,
//   attackerState: MonsterState,
//   defenderState: MonsterState,
//   a: Monster,
//   b: Monster,
//   stateA: MonsterState,
//   stateB: MonsterState,
//   random: () => number,
//   debug: boolean
// ): void {
//   // This would contain the doTurn logic but it may be too complex. Return to later.
// }

export function executeSpecialHandlers(
  monster: Monster,
  handlerType: 'onFightStart' | 'onTurnStart' | 'onTurnEnd' | 'onOpponentTurnStart' | 'onHit',
  ctx: HandlerContext,
  debug: boolean
): void {
  const specials = monster.special ?? {};
  for (const [key, param] of Object.entries(specials)) {
    const handler = specialHandlers[key];
    if (handler?.[handlerType]) {
      try {
        handler[handlerType]!(ctx, param);
      } catch (e) {
        if (debug) console.error(`special handler ${key} failed ${handlerType}:`, e);
      }
    }
  }
}

export function logRoundStatus(
  round: number,
  aLabel: string,
  bLabel: string,
  stateA: MonsterState,
  stateB: MonsterState
): void {
  console.log(`== Round ${round} ==`);
  const nameCol = (s: string) => s.padEnd(15);
  const hpCol = (n: number) => String(n).padStart(5);
  console.log(`${'Name'.padEnd(15)} ${'HP'.padStart(5)}   Status`);
  console.log(`${nameCol(aLabel)} ${hpCol(stateA.hp)}   ${stateA.toDebug()}`);
  console.log(`${nameCol(bLabel)} ${hpCol(stateB.hp)}   ${stateB.toDebug()}`);
}

export function logFinalStats(
  aLabel: string,
  bLabel: string,
  stateA: MonsterState,
  stateB: MonsterState
): void {
  console.log(`                  HP    HP      Damage`);
  console.log(`Name              Start End     Dealt    Status`);
  const formatStatus = (totals: Map<string, number>) => {
    const entries = Array.from(totals.entries()).filter(([_, count]) => count > 0);
    return entries.map(([name, count]) => `${name}(${count})`).join(', ') || 'none';
  };

  console.log(`${aLabel.padEnd(17)} ${stateA.maxHp.toString().padStart(5)} ${stateA.hp.toString().padStart(4)} ${stateA.damageDealt.toString().padStart(6)}      ${formatStatus(stateA.statusTotals)}`);
  console.log(`${bLabel.padEnd(17)} ${stateB.maxHp.toString().padStart(5)} ${stateB.hp.toString().padStart(4)} ${stateB.damageDealt.toString().padStart(6)}      ${formatStatus(stateB.statusTotals)}`);
}