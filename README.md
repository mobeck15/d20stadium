# D20 Arena

**D20 Arena** is an experimental combat simulation engine inspired by the open-content rules of *Dungeons & Dragons 3.5e*.  
Its goal is to model monster-vs-monster combat using Challenge Rating–style assumptions, allowing large-scale simulations, balance analysis, and ultimately “spectator-style” arena matchups.

This project prioritizes **systems clarity, extensibility, and iteration speed** over presentation or strict rules completeness.

---

## Project Goals

### Primary Goals
- Create a **robust, extensible monster combat engine** based on d20 mechanics
- Support large-scale **Monte Carlo simulations** to evaluate balance and outcomes
- Enable **custom monster creation** using modular abilities and status effects
- Allow creatures and teams to fight autonomously using simple tactical logic
- Produce readable, deterministic combat logs for debugging and analysis

### Long-Term Vision
- A “spectator sport” style arena where players predict outcomes
- An advanced encounter / monster generator for tabletop use
- Multi-creature team combat (2v2, 3v3, and beyond)
- Tactical decision-making influenced by positioning and abilities
- Optional graphical frontends (web or game engine based)

---

## Current Features

### Combat Engine
- Turn-based combat using initiative
- Deterministic dice rolling (with support for simulation runs)
- Attack resolution (to-hit, damage, critical logic where applicable)
- Immediate death handling and combat resolution

### Monsters
- Monsters defined via **JSON data files**
- Current monsters implemented:
  - Ogre
  - Dire Wolf
  - Ghast
  - Troll
- Monsters support:
  - Multiple attacks per turn
  - On-hit special abilities
  - Status-effect application

### Status Effect System
- Modular, composable status effects
- Effects currently implemented:
  - **Prone** (via Trip)
  - **Paralyzed**
  - **Sickened**
  - **Stench immunity**
- Duration tracking and automatic expiration
- Status effects can:
  - Prevent actions
  - Apply penalties
  - Block repeated saves or effects

### Simulation & Analysis
- Run **single verbose fights** for debugging
- Run **hundreds or thousands of simulations** for statistical output
- Summary statistics include:
  - Win rates
  - Average remaining HP
  - Average combat length (rounds)

### Logging
- Clear, round-based combat logs
- Unique naming for combatants
- End-of-fight summaries with damage dealt and final statuses

### Testing
- Growing unit test coverage
- Core combat logic and status behavior tested independently
- Refactoring underway to improve maintainability and correctness

---

## Example Usage

```bash
node dist/arena.js src/monsters/ogre.json src/monsters/ghast.json
```

Verbose debug mode:

```bash
node dist/arena.js src/monsters/direwolf.json src/monsters/ogre.json --debug
```

Simulation mode:

```bash
node dist/arena.js src/monsters/ghast.json src/monsters/ogre.json --simulations 1000
```

## Design Philosophy

- **Composition over inheritance**
  - Monsters are assembled from abilities, attacks, and effects
- **Engine-first**
  - No UI assumptions baked into core logic
- **Extensible by default**
  - Designed to scale from 1v1 → NvN without rewrites
- **Not a full D&D rules engine**
  - The goal is *useful abstraction*, not perfect RAW fidelity

---

## Planned Features (Roadmap)

### Near-Term
- Multi-monster team combat (2v2, 3v3, arbitrary team sizes)
- Target selection logic (random → heuristic-based)
- Team-based combat resolution
- Improved balance instrumentation

### Mid-Term
- Movement, reach, and positioning
- Size categories and reach weapons
- Ranged attacks and kiting behavior
- Smarter AI strategies (focus fire, threat evaluation)

### Long-Term
- Encounter generator and CR-based matchup suggestions
- “Arena mode” with spectator-style presentation
- UI layer (CLI TUI → Web → Game engine)
- Saveable scenarios and replayable fights

---

## Legal / Licensing Notes

This project uses concepts derived from the **D20 System Reference Document (SRD)**.  
No copyrighted non-SRD material is included.

This project is:
- Non-commercial
- Experimental
- Intended for educational and hobbyist use

---

## Status

🚧 **Active development**  
Expect breaking changes, refactors, and incomplete systems.
