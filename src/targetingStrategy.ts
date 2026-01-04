import type { Monster } from "./monster.js";
import type MonsterState from "./monsterState.js";

export interface ITargetingStrategy {
  selectTarget(
    opponents: FighterWithState[],
    random: () => number
  ): FighterWithState;
}

export type FighterWithState = {
  monster: Monster;
  state: MonsterState;
  teamIndex: number;
  memberIndex: number;
  label: string;
};

export type TargetingContext = {
  attacker: FighterWithState;
  lastTarget?: FighterWithState;
  damageReceived?: Map<string, number>;
};

export type TargetingStrategy = 
  | 'first'
  | 'last'
  | 'lowestHp'
  | 'highestHp'
  | 'random' 
  | 'sameAsLast'
  | 'mostDamageToMe';

export function selectTarget(
  opponents: FighterWithState[],
  strategy: TargetingStrategy,
  random: () => number,
  context?: TargetingContext
): FighterWithState {
  if (opponents.length === 0) {
    throw new Error('No opponents available');
  }

  switch (strategy) {
    case 'first':
      return opponents[0]!;
    
    case 'last':
      return opponents[opponents.length - 1]!;
    
    case 'lowestHp':
      return opponents.reduce((lowest, current) => 
        current.state.hp < lowest.state.hp ? current : lowest
      );
    
    case 'highestHp':
      return opponents.reduce((highest, current) => 
        current.state.hp > highest.state.hp ? current : highest
      );
    
    case 'random':
      const index = Math.floor(random() * opponents.length);
      return opponents[index]!;

      case 'sameAsLast':
      // Try to find the same target from last turn
      if (context?.lastTarget) {
        const sameTarget = opponents.find(
          opp => opp.memberIndex === context.lastTarget!.memberIndex
        );
        if (sameTarget) return sameTarget;
      }
      // Fall back to first if last target is dead/unavailable
      return opponents[0]!;
    
    case 'mostDamageToMe':
      if (!context?.damageReceived || context.damageReceived.size === 0) {
        // No damage received yet, pick first
        return opponents[0]!;
      }
      // Find opponent who dealt most damage
      return opponents.reduce((highest, current) => {
        const currentDamage = context.damageReceived!.get(current.label) ?? 0;
        const highestDamage = context.damageReceived!.get(highest.label) ?? 0;
        return currentDamage > highestDamage ? current : highest;
      });
    
    default:
      return opponents[0]!;
  }
}