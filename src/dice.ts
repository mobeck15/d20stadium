export function rollDice(expression: string, random: () => number = Math.random): number {
  // Supports XdY+Z
  const match = expression.match(/(\d+)d(\d+)(\+(\d+))?/);
  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }

  const dice = parseInt(match[1]!, 10);
  const sides = parseInt(match[2]!, 10);
  const bonus = match[4] ? parseInt(match[4]!, 10) : 0;

  let total = 0;
  for (let i = 0; i < dice; i++) {
    total += Math.floor(random() * sides) + 1;
  }

  return total + bonus;
}
