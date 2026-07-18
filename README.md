# @briine/sdk

The official TypeScript SDK for [Briine](https://briine.com).

## Installation

```sh
npm install @briine/sdk
```

## Usage / Starter Bot

```ts
// JavaScript/TS Node.js import
import BriineAgent from '@briine/sdk';

// For TypeScript support.
import type { Action, Character, MatchStatus, Spell } from '@briine/sdk';

// This is your individualized Briine Agent's "brain".
// Choose your strategy (or strategies) and implement here to compete.
class MyAgent extends BriineAgent {
    // Choose a character based on current draft.
    chooseCharacter(
        available: Character[], // Characters available to be selected.
        ally: Character[],      // Characters you've already selected.
        enemy: Character[],     // Characters your enemy has selected.
    ): Character {
        // This agent returns the first available character from the server.
        //
        // You could also choose randomly, or prioritize characters that
        // align with your intended strategy.
        return available[0];
    }

    // Choose spells based on current draft.
    chooseSpells(
        available: Spell[], // Spells available to be selected.
        ally: Character[],  // Characters you have selected.
        enemy: Character[]  // Characters your enemy has selected.
    ): Spell[] {
        // This agent returns all available spells from the server.
        // The server will truncate this selection automatically.
        return available;
    }

    // Choose action based on match status.
    chooseAction(status: MatchStatus): Action {
        // This agent selects the first available allied character.
        // You could also randomize this selection, or choose based on current MatchStatus.
        const source = status.sources[0];

        // This agent selects the first available enemy character.
        //
        // Some actions are multi-target. Pass an array of characters to select multiple.
        // Allied characters are also targetable, such as for healing spells.
        const target = status.targets[0];

        // This agent selects the first available Attack.
        // This could be an Attack, Spell, or "defend".
        const action = source.attacks[0];

        return { source, target, action };
    }
}

// Configure your agent with values from briine.com.
// Consider using dotenv or another solution to keep secret values out of your source code.
BriineAgent.register(
    new MyAgent(
        'username',
        'agent-name',
        'agent-version', // When strategic changes are made, make sure to iterate your version.
        'agent-secret',
        false, // Set to true to auto-requeue after matches.
    )
);
```

## BriineAgent Abstract / Required Methods

### `chooseCharacter(available: Character[], ally: Character[], enemy: Character[]): Character`

Called when your bot is prompted to select a character. Return the selected character.

### `chooseSpells(available: Spell[], ally: Character[], enemy: Character[]): Spell[]`

Called when your bot is prompted to select a spell pool. Return an array of spells.

### `chooseAction(status: MatchStatus): Action`

Called when your bot is prompted to take an action within a match. Return a valid Action.
