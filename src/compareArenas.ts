import { loadMonster } from "./arenaLib.js";
import { fight } from "./combat.js";
import { teamFight } from "./teamCombat.js";

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("-"));
const [fileA, fileB] = files;

if (!fileA || !fileB) {
  console.error("Usage: node compareArenas.js monsterA.json monsterB.json");
  process.exit(1);
}

const monsterA = loadMonster(fileA);
const monsterB = loadMonster(fileB);

console.log(`Comparing combat systems: ${monsterA.name} vs ${monsterB.name}\n`);

const simulations = 1000;
const seed = Math.floor(Math.random() * 1000000);
console.log(`Using seed: ${seed}\n`);

// Run old system
console.log("Running original combat system...");
let oldWinsA = 0;
let oldWinsB = 0;
let oldTotalHpA = 0;
let oldTotalHpB = 0;
let oldTotalRounds = 0;

for (let i = 0; i < simulations; i++) {
  const result = fight(monsterA, monsterB, { seed: seed + i });
  if (result.hpA > 0) oldWinsA++;
  else oldWinsB++;
  oldTotalHpA += result.hpA;
  oldTotalHpB += result.hpB;
  oldTotalRounds += result.rounds;
}

// Run new system
console.log("Running team combat system...");
let newWinsA = 0;
let newWinsB = 0;
let newTotalHpA = 0;
let newTotalHpB = 0;
let newTotalRounds = 0;

for (let i = 0; i < simulations; i++) {
  const result = teamFight([monsterA], [monsterB], { seed: seed + i });
  if (result.winningTeam === 0) newWinsA++;
  else newWinsB++;
  newTotalHpA += result.team0.members[0]!.hpEnd;
  newTotalHpB += result.team1.members[0]!.hpEnd;
  newTotalRounds += result.rounds;
}

// Compare results
console.log("\n=== COMPARISON RESULTS ===\n");

const oldWinRateA = (oldWinsA / simulations * 100).toFixed(2);
const newWinRateA = (newWinsA / simulations * 100).toFixed(2);
const oldAvgHpA = (oldTotalHpA / simulations).toFixed(2);
const newAvgHpA = (newTotalHpA / simulations).toFixed(2);
const oldAvgHpB = (oldTotalHpB / simulations).toFixed(2);
const newAvgHpB = (newTotalHpB / simulations).toFixed(2);
const oldAvgRounds = (oldTotalRounds / simulations).toFixed(2);
const newAvgRounds = (newTotalRounds / simulations).toFixed(2);

console.log(`${monsterA.name} Win Rate:`);
console.log(`  Original: ${oldWinRateA}%`);
console.log(`  Team:     ${newWinRateA}%`);
console.log(`  Difference: ${(parseFloat(newWinRateA) - parseFloat(oldWinRateA)).toFixed(2)}%`);

console.log(`\n${monsterA.name} Average HP at End:`);
console.log(`  Original: ${oldAvgHpA}`);
console.log(`  Team:     ${newAvgHpA}`);
console.log(`  Difference: ${(parseFloat(newAvgHpA) - parseFloat(oldAvgHpA)).toFixed(2)}`);

console.log(`\n${monsterB.name} Average HP at End:`);
console.log(`  Original: ${oldAvgHpB}`);
console.log(`  Team:     ${newAvgHpB}`);
console.log(`  Difference: ${(parseFloat(newAvgHpB) - parseFloat(oldAvgHpB)).toFixed(2)}`);

console.log(`\nAverage Rounds:`);
console.log(`  Original: ${oldAvgRounds}`);
console.log(`  Team:     ${newAvgRounds}`);
console.log(`  Difference: ${(parseFloat(newAvgRounds) - parseFloat(oldAvgRounds)).toFixed(2)}`);

// Determine if systems match
const winRateDiff = Math.abs(parseFloat(newWinRateA) - parseFloat(oldWinRateA));
const hpDiffA = Math.abs(parseFloat(newAvgHpA) - parseFloat(oldAvgHpA));
const hpDiffB = Math.abs(parseFloat(newAvgHpB) - parseFloat(oldAvgHpB));
const roundsDiff = Math.abs(parseFloat(newAvgRounds) - parseFloat(oldAvgRounds));

const tolerance = 1.0; // Allow 1% difference due to rounding/small variations

console.log("\n=== VERDICT ===");
if (winRateDiff < tolerance && hpDiffA < tolerance && hpDiffB < tolerance && roundsDiff < 0.1) {
  console.log("✓ Systems match! Results are statistically equivalent.");
} else {
  console.log("✗ Systems differ! There may be implementation differences.");
  if (winRateDiff >= tolerance) console.log(`  - Win rate difference: ${winRateDiff.toFixed(2)}%`);
  if (hpDiffA >= tolerance) console.log(`  - ${monsterA.name} HP difference: ${hpDiffA.toFixed(2)}`);
  if (hpDiffB >= tolerance) console.log(`  - ${monsterB.name} HP difference: ${hpDiffB.toFixed(2)}`);
  if (roundsDiff >= 0.1) console.log(`  - Rounds difference: ${roundsDiff.toFixed(2)}`);
}