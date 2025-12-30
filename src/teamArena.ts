import { parseArgs, loadMonster } from "./arenaLib.js";
import { teamFight } from "./teamCombat.js";

try {
    const { debug, seed, files } = parseArgs(process.argv);
    const [teamAFiles, teamBFiles] = files;

    // Parse comma-separated monster files for each team
    const team0Files = teamAFiles!.split(',');
    const team1Files = teamBFiles!.split(',');

    const team0Monsters = team0Files.map(f => loadMonster(f.trim()));
    const team1Monsters = team1Files.map(f => loadMonster(f.trim()));

    if (debug) {
        const team0Names = team0Monsters.map(m => m.name).join(', ');
        const team1Names = team1Monsters.map(m => m.name).join(', ');
        console.log(`Debug mode: Team 1 (${team0Names}) vs Team 2 (${team1Names})`);
        const result = teamFight(team0Monsters, team1Monsters, { debug: true, seed });
        console.log(`Winner: Team ${result.winningTeam + 1}`);
        console.log(`Rounds: ${result.rounds}`);
    } else {
    const simulations = 1000;
let winsA = 0;
let winsB = 0;
let totalRounds = 0;

// Track cumulative HP for each monster
const totalHpA = Array(team0Monsters.length).fill(0);
const totalHpB = Array(team1Monsters.length).fill(0);

for (let i = 0; i < simulations; i++) {
  const result = teamFight(team0Monsters, team1Monsters, { seed: seed + i });

  if (result.winningTeam === 0) winsA++;
  else winsB++;

  // Sum HP for each monster
  result.team0.members.forEach((m, idx) => {
    totalHpA[idx] += m.hpEnd;
  });

  result.team1.members.forEach((m, idx) => {
    totalHpB[idx] += m.hpEnd;
  });

  totalRounds += result.rounds;
}

const winRateA = parseFloat((winsA / simulations).toFixed(2));
const winRateB = parseFloat((winsB / simulations).toFixed(2));
const avgRounds = parseFloat((totalRounds / simulations).toFixed(2));

// Build member summaries
const team1Summary = team0Monsters.map((monster, idx) => ({
  name: monster.name,
  avg_HP_at_end: parseFloat((totalHpA[idx] / simulations).toFixed(2)),
  avg_rounds_survived: avgRounds
}));

const team2Summary = team1Monsters.map((monster, idx) => ({
  name: monster.name,
  avg_HP_at_end: parseFloat((totalHpB[idx] / simulations).toFixed(2)),
  avg_rounds_survived: avgRounds
}));

console.log(JSON.stringify({
  matchup: `Team 1 vs Team 2`,
  simulations,
  "Team 1 win rate": winRateA,
  "Team 2 win rate": winRateB,
  "Team 1 members": team1Summary,
  "Team 2 members": team2Summary,
  average_rounds: avgRounds,
}, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}