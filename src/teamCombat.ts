import type { Monster } from "./monster.js";
import MonsterState from "./monsterState.js";
import { rollInitiative, resolveAttack, createHandlerContext, mulberry32 } from "./combatHelpers.js";
import { executeSpecialHandlers } from "./turnExecutor.js";

export type Team = {
  members: Monster[];
  states: MonsterState[];
  label: string;
};

export type CombatState = {
  teams: [Team, Team];
  random: () => number;
  debug: boolean;
  round: number;
};

export type TeamFightOptions = {
  debug?: boolean;
  seed?: number;
};

export type TeamFightResult = {
  winningTeam: number; // 0 or 1
  rounds: number;
  team0: {
    members: Array<{
      name: string;
      hpStart: number;
      hpEnd: number;
      damageDealt: number;
      statusTotals: Map<string, number>;
    }>;
  };
  team1: {
    members: Array<{
      name: string;
      hpStart: number;
      hpEnd: number;
      damageDealt: number;
      statusTotals: Map<string, number>;
    }>;
  };
};

type FighterWithState = {
  monster: Monster;
  state: MonsterState;
  teamIndex: number;
  memberIndex: number;
  label: string;
};

/**
 * Creates a team from an array of monsters
 */
export function createTeam(monsters: Monster[], teamIndex: number): Team {
  return {
    members: monsters,
    states: monsters.map(m => new MonsterState(m)),
    label: `Team ${teamIndex + 1}`
  };
}

/**
 * Checks if a team has any living members
 */
export function isTeamAlive(team: Team): boolean {
  return team.states.some(state => state.hp > 0);
}

/**
 * Gets all living fighters from a team
 */
export function getLivingFighters(team: Team, teamIndex: number): FighterWithState[] {
  return team.states
    .map((state, memberIndex) => {
      const monster = team.members[memberIndex];
      if (!monster) return null;
      return {
        monster,
        state,
        teamIndex,
        memberIndex,
        label: `${monster.name}(${teamIndex + 1}.${memberIndex + 1})`
      };
    })
    .filter((f): f is FighterWithState => f !== null && f.state.hp > 0);
}

/**
 * Applies damage from attacker to defender
 */
export function applyDamage(
  defenderState: MonsterState,
  attackerState: MonsterState,
  damage: number
): void {
  defenderState.hp -= damage;
  attackerState.damageDealt += damage;
}

/**
 * Executes a single fighter's turn
 */
export function executeFighterTurn(
  attacker: FighterWithState,
  defender: FighterWithState,
  combatState: CombatState
): void {
  const { random, debug } = combatState;
  
  if (debug) console.log(`-- ${attacker.label} turn`);

  // Get opposing team for handler context
  const opposingTeam = combatState.teams[defender.teamIndex];
  const attackingTeam = combatState.teams[attacker.teamIndex];
  
  // For handler context, use first member of each team (legacy compatibility)
  const teamAFirstMember = combatState.teams[0].members[0];
  const teamBFirstMember = combatState.teams[1].members[0];
  
  if (!teamAFirstMember || !teamBFirstMember) {
    throw new Error('Teams must have at least one member');
  }

  // Create context for this turn
  const ctx = createHandlerContext(
    teamAFirstMember,
    teamBFirstMember,
    attacker.state,
    defender.state,
    attacker.monster,
    defender.monster,
    attacker.label,
    defender.label,
    random,
    debug
  );

  // Run onTurnStart handlers
  executeSpecialHandlers(attacker.monster, 'onTurnStart', ctx, debug);
  executeSpecialHandlers(defender.monster, 'onOpponentTurnStart', ctx, debug);

  const attacks = attacker.monster.attacks;
  let attacksCount = Math.min(attacks.length, attacker.monster.attacks_per_round);
  
  // Check if any status causes loseTurn
  const losingStatuses = attacker.state.statuses.filter((s) => s.loseTurn && s.duration > 0);
  if (losingStatuses.length > 0) {
    attacksCount = 0;
    const statusStr = losingStatuses.map(s => `${s.name} (${s.duration} rounds remaining)`).join(', ');
    if (debug) console.log(`${attacker.monster.name} loses their turn → ${statusStr}`);
  }

  // Execute attacks
  for (let i = 0; i < attacksCount; i++) {
    const attack = attacks[i]!;
    const result = resolveAttack(
      attacker.monster,
      defender.monster,
      attacker.state,
      defender.state,
      attack,
      random
    );
    
    // Apply damage
    if (result.isHit) {
      applyDamage(defender.state, attacker.state, result.damage);
    }

    // Debug logging
    if (debug) {
      const { base1, base2, chosen } = result.rolls;
      const rollsRaw = base2 != null ? `${base1},${base2}` : `${base1}`;
      const rollDisplay = base2 != null ? `${chosen} (from ${rollsRaw})` : `${chosen}`;
      const resultStr = result.isHit ? `HIT - ${result.damage} damage` : `MISS`;
      console.log(`${attacker.label} attacks ${defender.label} with ${attack.name}: ${rollDisplay} vs AC ${defender.monster.ac} ${resultStr}`);
      
      // Call onHit handlers after attack resolution/logging
      if (result.isHit) {
        executeSpecialHandlers(attacker.monster, 'onHit', ctx, debug);
      }
    }

    // Stop attacking if defender is dead
    if (defender.state.hp <= 0) {
      if (debug) console.log(`${defender.label} has been defeated!`);
      break;
    }
  }

  // Run onTurnEnd handlers
  executeSpecialHandlers(attacker.monster, 'onTurnEnd', ctx, debug);

  // Decrement status durations
  attacker.state.tickStatuses();
}

/**
 * Determines initiative order for all living fighters
 */
export function rollInitiativeOrder(combatState: CombatState): FighterWithState[] {
  const allFighters: FighterWithState[] = [];
  
  combatState.teams.forEach((team, teamIndex) => {
    allFighters.push(...getLivingFighters(team, teamIndex));
  });

  // Roll initiative for each fighter
  const fightersWithInit = allFighters.map(fighter => ({
    fighter,
    initiative: rollInitiative(fighter.monster, combatState.random)
  }));

  // Sort by initiative (highest first)
  fightersWithInit.sort((a, b) => b.initiative - a.initiative);

  if (combatState.debug) {
    console.log(`Initiative order: ${fightersWithInit.map(f => `${f.fighter.label}=${f.initiative}`).join(', ')}`);
  }

  return fightersWithInit.map(f => f.fighter);
}

/**
 * Executes a single round of combat
 */
export function executeRound(combatState: CombatState, turnOrder?: FighterWithState[]): boolean {
  if (combatState.debug) {
    console.log(`\n== Round ${combatState.round} ==`);
    logTeamStatus(combatState);
  }

  // Get turn order for this round
  const fighters = turnOrder ?? rollInitiativeOrder(combatState);

  // Each fighter takes their turn
  for (const attacker of fighters) {
    // Check if attacker is still alive
    if (attacker.state.hp <= 0) continue;

    // Find a living target from opposing team
    const opposingTeamIndex = attacker.teamIndex === 0 ? 1 : 0;
    const opposingTeam = combatState.teams[opposingTeamIndex];
    const livingOpponents = getLivingFighters(opposingTeam, opposingTeamIndex);

    if (livingOpponents.length === 0) {
      // Combat is over
      return false;
    }

    // Pick first living opponent (could add targeting logic here later)
    const defender = livingOpponents[0];
    if (!defender) continue; // Extra safety check

    // Execute the turn
    executeFighterTurn(attacker, defender, combatState);

    // Check if combat should end
    if (!isTeamAlive(opposingTeam)) {
      return false;
    }
  }

  combatState.round++;
  return true;
}

/**
 * Logs current status of all teams
 */
export function logTeamStatus(combatState: CombatState): void {
  combatState.teams.forEach((team, teamIndex) => {
    console.log(`${team.label}:`);
    team.states.forEach((state, memberIndex) => {
      const monster = team.members[memberIndex];
      if (!monster) return;
      const status = state.toDebug();
      const hpDisplay = state.hp > 0 ? `${state.hp}/${state.maxHp}` : 'DEFEATED';
      console.log(`  ${monster.name}: ${hpDisplay} HP, Status: ${status}`);
    });
  });
}

/**
 * Logs final combat statistics
 */
export function logFinalTeamStats(combatState: CombatState): void {
  console.log('\n=== Final Statistics ===');
  combatState.teams.forEach((team, teamIndex) => {
    console.log(`\n${team.label}:`);
    team.states.forEach((state, memberIndex) => {
      const monster = team.members[memberIndex];
      if (!monster) return;
      const formatStatus = (totals: Map<string, number>) => {
        const entries = Array.from(totals.entries()).filter(([_, count]) => count > 0);
        return entries.map(([name, count]) => `${name}(${count})`).join(', ') || 'none';
      };
      console.log(`  ${monster.name.padEnd(20)} HP: ${state.maxHp.toString().padStart(3)} → ${state.hp.toString().padStart(3)}  Damage: ${state.damageDealt.toString().padStart(4)}  Status: ${formatStatus(state.statusTotals)}`);
    });
  });
}

/**
 * Main team combat function
 */
export function teamFight(
  team0Monsters: Monster[],
  team1Monsters: Monster[],
  opts?: TeamFightOptions
): TeamFightResult {
  const debug = !!opts?.debug;
  
  // Set up random number generator
  let random: () => number = Math.random;
  if (opts?.seed !== undefined) {
    random = mulberry32(opts.seed);
  }

  // Create teams
  const team0 = createTeam(team0Monsters, 0);
  const team1 = createTeam(team1Monsters, 1);

  // Initialize combat state
  const combatState: CombatState = {
    teams: [team0, team1],
    random,
    debug,
    round: 1
  };

  // Run onFightStart handlers for all fighters
  if (debug) console.log('=== Combat Start ===');
  
  [team0, team1].forEach((team, teamIndex) => {
    team.members.forEach((monster, memberIndex) => {
      const state = team.states[memberIndex];
      if (!state) return;
      
      const label = `${monster.name}(${teamIndex + 1}.${memberIndex + 1})`;
      const opposingTeam = combatState.teams[teamIndex === 0 ? 1 : 0];
      const opposingFirstMember = opposingTeam.members[0];
      const opposingFirstState = opposingTeam.states[0];
      
      if (!opposingFirstMember || !opposingFirstState) return;
      
      const ctx = createHandlerContext(
        team0.members[0]!,
        team1.members[0]!,
        state,
        opposingFirstState,
        monster,
        opposingFirstMember,
        label,
        `${opposingFirstMember.name}(${teamIndex === 0 ? 2 : 1}.1)`,
        random,
        debug
      );
      
      executeSpecialHandlers(monster, 'onFightStart', ctx, debug);
    });
  });

  // Roll initiative once at the start (like old system)
  const turnOrder = rollInitiativeOrder(combatState);

  // Execute rounds until one team is defeated
  while (isTeamAlive(team0) && isTeamAlive(team1)) {
    const shouldContinue = executeRound(combatState, turnOrder); // Pass turnOrder
    if (!shouldContinue) break;
  }

  // Calculate final round count (current round is the last round that was executed)
  const finalRounds = combatState.round;

  // Log final stats
  if (debug) {
    logFinalTeamStats(combatState);
  }

  // Determine winner
  const winningTeam = isTeamAlive(team0) ? 0 : 1;

  // Build result
  const buildTeamResult = (team: Team) => ({
    members: team.states.map((state, idx) => {
      const monster = team.members[idx];
      if (!monster) throw new Error(`Monster at index ${idx} is undefined`);
      return {
        name: monster.name,
        hpStart: state.maxHp,
        hpEnd: state.hp,
        damageDealt: state.damageDealt,
        statusTotals: state.statusTotals
      };
    })
  });

  return {
    winningTeam,
    rounds: finalRounds,
    team0: buildTeamResult(team0),
    team1: buildTeamResult(team1)
  };
}