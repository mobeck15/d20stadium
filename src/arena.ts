import { fight } from "./combat.js";
import { parseArgs, runSimulations, formatResults, loadMonster } from "./arenaLib.js";

try {
  const { debug, seed, files } = parseArgs(process.argv);
  const [fileA, fileB] = files;
  
  const monsterA = loadMonster(fileA);
  const monsterB = loadMonster(fileB);

  if (debug) {
    console.log(`Debug mode: running a single verbose fight...`);
    const result = fight(monsterA, monsterB, { debug: true, seed });
    console.log(`Winner: ${result.winner}`);
    console.log(`Rounds: ${result.rounds}`);
  } else {
    const results = runSimulations(monsterA, monsterB, 1000, seed);
    console.log(formatResults(monsterA, monsterB, results));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}