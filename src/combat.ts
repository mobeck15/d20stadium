import type { Monster } from "./monster.js";
import MonsterState from "./monsterState.js";
import { rollInitiative, resolveAttack, createHandlerContext, mulberry32 } from "./combatHelpers.js";
import { executeSpecialHandlers, logFinalStats, logRoundStatus } from "./turnExecutor.js";

export type FightOptions = { 
  debug?: boolean; 
  seed?: number 
};

export type FightResult = {
  winner: string;
  hpA: number;
  hpB: number;
  rounds: number;
};

export function fight(a: Monster, b: Monster, opts?: FightOptions): FightResult {
  const debug = !!opts?.debug;
  const stateA = new MonsterState(a);
  const stateB = new MonsterState(b);
  const aLabel = `${a.name}(1)`;
  const bLabel = `${b.name}(2)`;

  let random: () => number = Math.random;
  if (opts?.seed !== undefined) {
    random = mulberry32(opts.seed);
  }

  const initA = rollInitiative(a, random);
  const initB = rollInitiative(b, random);

  if (debug) console.log(`Initiative: ${aLabel}=${initA}, ${bLabel}=${initB}`);

  const first = initA >= initB ? a : b;
  const second = first === a ? b : a;

  let attacker = first;
  let defender = second;
  let attackerState = attacker === a ? stateA : stateB;
  let defenderState = defender === a ? stateA : stateB;
  let round = 1;

  // Run onFightStart handlers for both monsters
  const ctxA = createHandlerContext(a, b, stateA, stateB, a, b, aLabel, bLabel, random, debug);
  executeSpecialHandlers(a, 'onFightStart', ctxA, debug);
  
  const ctxB = createHandlerContext(a, b, stateB, stateA, b, a, bLabel, aLabel, random, debug);
  executeSpecialHandlers(b, 'onFightStart', ctxB, debug);

  while (stateA.hp > 0 && stateB.hp > 0) {
    if (debug) {
      logRoundStatus(round, aLabel, bLabel, stateA, stateB);
    }

    // Function to perform a turn
    const doTurn = (currentAttacker: Monster, currentDefender: Monster, currentAttackerState: MonsterState, currentDefenderState: MonsterState) => {
      const currentAttackerLabel = currentAttacker === a ? aLabel : bLabel;
      const currentDefenderLabel = currentDefender === a ? aLabel : bLabel;
      if (debug) console.log(`-- ${currentAttackerLabel} turn`);

      // Create context for this turn
      const ctx = createHandlerContext(
        a, b,
        currentAttackerState, currentDefenderState,
        currentAttacker, currentDefender,
        currentAttackerLabel, currentDefenderLabel,
        random, debug
      );

      // Run onTurnStart handlers
      executeSpecialHandlers(currentAttacker, 'onTurnStart', ctx, debug);
      executeSpecialHandlers(currentDefender, 'onOpponentTurnStart', ctx, debug);

      const attacks = currentAttacker.attacks;
      let attacksCount = Math.min(attacks.length, currentAttacker.attacks_per_round);
      const attackerStatuses = currentAttackerState.statuses;
      
      // Check if any status causes loseTurn
      const losingStatuses = attackerStatuses.filter((s) => s.loseTurn && s.duration > 0);
      if (losingStatuses.length > 0) {
        attacksCount = 0;
        const statusStr = losingStatuses.map(s => `${s.name} (${s.duration} rounds remaining)`).join(', ');
        if (debug) console.log(`${currentAttacker.name} loses their turn → ${statusStr}`);
      }

      // Execute attacks
      for (let i = 0; i < attacksCount; i++) {
        const attack = attacks[i]!;
        const result = resolveAttack(currentAttacker, currentDefender, currentAttackerState, currentDefenderState, attack, random);
        
        // Apply damage
        if (result.isHit) {
          if (currentDefender === a) {
            stateA.hp -= result.damage;
            stateB.damageDealt += result.damage;
          } else {
            stateB.hp -= result.damage;
            stateA.damageDealt += result.damage;
          }
        }

        // Debug logging
        if (debug) {
          const { base1, base2, chosen } = result.rolls;
          const rollsRaw = base2 != null ? `${base1},${base2}` : `${base1}`;
          const rollDisplay = base2 != null ? `${chosen} (from ${rollsRaw})` : `${chosen}`;
          const resultStr = result.isHit ? `HIT - ${result.damage} damage` : `MISS`;
          console.log(`${currentAttackerLabel} attacks ${currentDefenderLabel} with ${attack.name}: ${rollDisplay} vs AC ${currentDefender.ac} ${resultStr}`);
          
          // Call onHit handlers after attack resolution/logging
          if (result.isHit) {
            executeSpecialHandlers(currentAttacker, 'onHit', ctx, debug);
          }
        }
      }

      // Run onTurnEnd handlers
      executeSpecialHandlers(currentAttacker, 'onTurnEnd', ctx, debug);

      // Decrement status durations
      if (currentAttacker === a) stateA.tickStatuses();
      else stateB.tickStatuses();
    };

    // First turn
    doTurn(attacker, defender, attackerState, defenderState);

    if (defenderState.hp > 0) {
      // Swap turns
      [attacker, defender] = [defender, attacker];
      [attackerState, defenderState] = [defenderState, attackerState];

      // Second turn
      doTurn(attacker, defender, attackerState, defenderState);

      // Swap back for next round
      [attacker, defender] = [defender, attacker];
      [attackerState, defenderState] = [defenderState, attackerState];
    }

    round++;
  }

  if (debug) {
    logFinalStats(aLabel, bLabel, stateA, stateB);
  }

  return {
    winner: stateA.hp > 0 ? aLabel : bLabel,
    hpA: stateA.hp,
    hpB: stateB.hp,
    rounds: round - 1,
  };
}