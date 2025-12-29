import type { Monster } from "./monster.js";
import { fight } from "./combat.js";
import * as fs from "fs";
import * as path from "path";

export function parseArgs(argv: string[]): {
  debug: boolean;
  seed: number;
  files: [string, string];
} {
  const args = argv.slice(2);
  const debug = args.includes("--debug");
  const seedArg = args.find(a => a.startsWith('--seed='));
  
  let seed: number;
  if (seedArg) {
    const seedStr = seedArg.split('=')[1];
    if (!seedStr) {
      throw new Error("Invalid seed format. Use --seed=NUMBER");
    }
    seed = parseInt(seedStr);
  } else {
    seed = Math.floor(Math.random() * 1000000);
  }
  
  const files = args.filter((a) => !a.startsWith("-") && !a.startsWith('--seed'));
  if (files.length !== 2) {
    throw new Error("Expected exactly 2 monster files");
  }
  
  return { debug, seed, files: files as [string, string] };
}

export type SimulationResults = {
  winsA: number;
  winsB: number;
  totalHpA: number;
  totalHpB: number;
  totalRounds: number;
  simulations: number;
};

export function runSimulations(
  monsterA: Monster,
  monsterB: Monster,
  count: number,
  seedStart: number
): SimulationResults {
  let winsA = 0;
  let winsB = 0;
  let totalHpA = 0;
  let totalHpB = 0;
  let totalRounds = 0;

  for (let i = 0; i < count; i++) {
    const res = fight(monsterA, monsterB, { seed: seedStart + i });
    if (res.hpA > 0) winsA++;
    else winsB++;
    totalHpA += res.hpA;
    totalHpB += res.hpB;
    totalRounds += res.rounds;
  }

  return { winsA, winsB, totalHpA, totalHpB, totalRounds, simulations: count };
}

export function formatResults(
  monsterA: Monster,
  monsterB: Monster,
  results: SimulationResults
): string {
  const { winsA, winsB, totalHpA, totalHpB, totalRounds, simulations } = results;
  
  const winRateA = parseFloat((winsA / simulations).toFixed(2));
  const winRateB = parseFloat((winsB / simulations).toFixed(2));
  const avgHpA = parseFloat((totalHpA / simulations).toFixed(2));
  const avgHpB = parseFloat((totalHpB / simulations).toFixed(2));
  const avgRounds = parseFloat((totalRounds / simulations).toFixed(2));

  return JSON.stringify({
    matchup: `Team 1 vs Team 2`,
    simulations,
    "Team 1 win rate": winRateA,
    "Team 2 win rate": winRateB,
    "Team 1 members": [
      {
        name: monsterA.name,
        "avg_HP_at_end": avgHpA,
        "avg_rounds_survived": avgRounds
      }
    ],
    "Team 2 members": [
      {
        name: monsterB.name,
        "avg_HP_at_end": avgHpB,
        "avg_rounds_survived": avgRounds
      }
    ],
    average_rounds: avgRounds,
  }, null, 2);
}

export function loadMonster(file: string): Monster {
  const fullPath = path.resolve(file);
  try {
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load monster from ${file}: ${error}`);
  }
}