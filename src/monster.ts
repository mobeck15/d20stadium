export type Specials = {
  regeneration?: number;
  [key: string]: unknown;
};

export interface Monster {
  name: string;
  cr: number;
  hp: number;
  ac: number;
  attack_bonus: number;
  attacks: Array<{name: string, damage: string, bonus?: number}>;
  attacks_per_round: number;
  initiative: number;
  saves: {
    fort: number;
    ref: number;
    will: number;
  };
  special?: Specials;
  tags: string[];
}
