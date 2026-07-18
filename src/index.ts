import WebSocket from 'ws';

export type Stack = {
    red:    number;
    blue:   number;
    green:  number;
    yellow: number;
    light:  number;
    dark:   number;
    purple: number;
    orange: number;
};

export type Attack = {
    id: string;
    name: string;
    element: string;
};

export type ActionRequest = {
    id: string,
    type: 'attack' | 'spell' | 'defend',
    source: string,
    target?: string[],
};

export type Action = {
    action: Attack | Spell | 'defend';
    source: string | Ally;
    target: string | string[] | Character | Character[];
};

export type AuthResponse = {
    success: boolean;
    token?: string;
    user?: { id?: string; username?: string };
    agent?: { id: string; user_id: string; name: string };
    version?: { id: string; agent_id: string; version: string; label?: string | null; config_json?: string | null };
    secret?: string;
    error?: string;
};

export type RotateSecretResponse = {
    success: boolean;
    agent?: { id: string; user_id: string; name: string };
    secret?: string;
    error?: string;
};

export type AgentsResponse = {
    success: boolean;
    agents?: Array<{
        id: string;
        user_id: string;
        name: string;
        versions: Array<{ id: string; agent_id: string; version: string; label?: string | null; config_json?: string | null }>;
    }>;
    error?: string;
};

export type AgentVersionResponse = {
    success: boolean;
    version?: { id: string; agent_id: string; version: string; label?: string | null; config_json?: string | null };
    error?: string;
};

export type ServerMessage =
    { type: 'error', message: string } |
    {};

export type ServerPrompt =
    { type: 'prompt' };

export type ClientMessage =
    {};

export type Character = {
    id: string,
    name: string,
    class: string,
    primary: { id: string, op: string },
    secondary: { id: string, op: string },
    hp: number,
    isDefended: boolean,
    canAct: boolean,
    stamina: number,
    attacks: Attack[],
    effects: { name: string, description: string, active: boolean }[],
};

export type AllySpell = Spell & {
    name: string,
    cooldown: number,
    currentCooldown: number,
    available: boolean,
};

export type Ally = (
    Character
    & {
        spells: AllySpell[]
    }
);

export type Spell = {
    id: string,
    element: string
    maxTargets: number,
    stamina: number,
    stackCost: number,
    effects?: { name: string, description: string }[],
    description: string,
    available?: boolean
};

export type ServerStatus = {
    ally: Ally[],
    sources: Ally[],
    enemy: Character[],
    targets: Character[],
    stack: Stack,
}

export type MatchStatus = {
    sources: Ally[],
    targets: Character[],
    livingAllies: Ally[],
    livingEnemies: Character[],
    fallenAllies: Ally[],
    fallenEnemies: Character[],
    defendedAllies: Ally[],
    undefendedAllies: Ally[],
    castableSpells: Array<{ source: Ally; spell: AllySpell }>,
    supportSpellOptions: Array<{ source: Ally; spell: AllySpell }>,
    offensiveSpellOptions: Array<{ source: Ally; spell: AllySpell }>,
    utilitySpellOptions: Array<{ source: Ally; spell: AllySpell }>,
    multiTargetSpellOptions: Array<{ source: Ally; spell: AllySpell }>,
    singleTargetSpellOptions: Array<{ source: Ally; spell: AllySpell }>,
    attackOptions: Array<{ source: Ally; attack: Attack }>,
    allyById: Record<string, Ally>,
    enemyById: Record<string, Character>,
    sourceById: Record<string, Ally>,
    targetById: Record<string, Character>,
    castableSpellsBySourceId: Record<string, AllySpell[]>,
    attacksBySourceId: Record<string, Attack[]>,
    allyHpTotal: number,
    enemyHpTotal: number,
    allyHpAverage: number,
    enemyHpAverage: number,
    allyStaminaTotal: number,
    enemyStaminaTotal: number,
    lowestHpAlly?: Ally,
    highestHpAlly?: Ally,
    lowestHpEnemy?: Character,
    highestHpEnemy?: Character,
    highestStaminaEnemy?: Character,
    lowestStaminaEnemy?: Character,
    enemiesByLowestHp: Character[],
    enemiesByHighestStamina: Character[],
    alliesByLowestHp: Ally[],
    alliesByHighestStamina: Ally[],
    vulnerableEnemies: Character[],
    defendedEnemies: Character[],
    activeEnemies: Character[],
    actionEconomyLead: number,
    hpLead: number,
    hasActionEconomyLead: boolean,
    hasHpLead: boolean,
    hasCastableSpells: boolean,
    hasMultiTargetSpell: boolean,
    canAnySourceAct: boolean,
} & ServerStatus;

function sumHp(characters: Character[]): number {
    return characters.reduce((total, character) => total + Math.max(character.hp, 0), 0);
}

function averageHp(characters: Character[]): number {
    return characters.length > 0 ? sumHp(characters) / characters.length : 0;
}

function sumStamina(characters: Character[]): number {
    return characters.reduce((total, character) => total + Math.max(character.stamina, 0), 0);
}

function joinSpellText(spell: Spell): string {
    return [spell.id, spell.element, spell.description, ...(spell.effects ? spell.effects.map(effect => `${effect.name} ${effect.description}`) : [])].join(' ').toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
    return terms.some(term => text.includes(term));
}

function classifySpell(spell: Spell): 'support' | 'offensive' | 'utility' {
    const text = joinSpellText(spell);
    const supportTerms = ['heal', 'restore', 'ward', 'shield', 'guard', 'protect', 'cleanse', 'revive', 'resurrect', 'support', 'renew'];
    const offensiveTerms = ['damage', 'burn', 'poison', 'bleed', 'curse', 'drain', 'steal', 'strike', 'blast', 'shock', 'weaken', 'vulnerable', 'stun', 'slow'];

    const support = includesAny(text, supportTerms);
    const offensive = includesAny(text, offensiveTerms);

    if (support && !offensive) {
        return 'support';
    }

    if (offensive && !support) {
        return 'offensive';
    }

    return 'utility';
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
    return items.reduce<Record<string, T>>((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {});
}

function groupCastableSpellsBySourceId(castableSpells: Array<{ source: Ally; spell: AllySpell }>): Record<string, AllySpell[]> {
    return castableSpells.reduce<Record<string, AllySpell[]>>((acc, option) => {
        if (!acc[option.source.id]) {
            acc[option.source.id] = [];
        }

        acc[option.source.id].push(option.spell);
        return acc;
    }, {});
}

function groupAttacksBySourceId(attackOptions: Array<{ source: Ally; attack: Attack }>): Record<string, Attack[]> {
    return attackOptions.reduce<Record<string, Attack[]>>((acc, option) => {
        if (!acc[option.source.id]) {
            acc[option.source.id] = [];
        }

        acc[option.source.id].push(option.attack);
        return acc;
    }, {});
}

function bestBy<T>(items: T[], score: (item: T) => number): T | undefined {
    return items.reduce<T | undefined>((best, item) => {
        if (!best || score(item) > score(best)) {
            return item;
        }

        return best;
    }, undefined);
}

function worstBy<T>(items: T[], score: (item: T) => number): T | undefined {
    return items.reduce<T | undefined>((worst, item) => {
        if (!worst || score(item) < score(worst)) {
            return item;
        }

        return worst;
    }, undefined);
}

function toMatchStatus(status: ServerStatus): MatchStatus {
    const sources = status.ally.filter(character => character.canAct);
    const targets = status.enemy.filter(character => character.hp > 0);
    const livingAllies = status.ally.filter(character => character.hp > 0);
    const livingEnemies = status.enemy.filter(character => character.hp > 0);
    const fallenAllies = status.ally.filter(character => character.hp <= 0);
    const fallenEnemies = status.enemy.filter(character => character.hp <= 0);
    const defendedAllies = livingAllies.filter(character => character.isDefended);
    const undefendedAllies = livingAllies.filter(character => !character.isDefended);
    const castableSpells = sources.flatMap(source => source.spells.filter(spell => spell.available).map(spell => ({ source, spell })));
    const supportSpellOptions = castableSpells.filter(option => classifySpell(option.spell) === 'support');
    const offensiveSpellOptions = castableSpells.filter(option => classifySpell(option.spell) === 'offensive');
    const utilitySpellOptions = castableSpells.filter(option => classifySpell(option.spell) === 'utility');
    const multiTargetSpellOptions = castableSpells.filter(option => (option.spell.maxTargets ?? 1) > 1);
    const singleTargetSpellOptions = castableSpells.filter(option => (option.spell.maxTargets ?? 1) <= 1);
    const attackOptions = sources.flatMap(source => source.attacks.map(attack => ({ source, attack })));
    const allyById = indexById(status.ally);
    const enemyById = indexById(status.enemy);
    const sourceById = indexById(sources);
    const targetById = indexById(targets);
    const castableSpellsBySourceId = groupCastableSpellsBySourceId(castableSpells);
    const attacksBySourceId = groupAttacksBySourceId(attackOptions);
    const allyHpTotal = sumHp(livingAllies);
    const enemyHpTotal = sumHp(livingEnemies);
    const allyHpAverage = averageHp(livingAllies);
    const enemyHpAverage = averageHp(livingEnemies);
    const allyStaminaTotal = sumStamina(livingAllies);
    const enemyStaminaTotal = sumStamina(livingEnemies);
    const lowestHpAlly = worstBy(livingAllies, character => character.hp);
    const highestHpAlly = bestBy(livingAllies, character => character.hp);
    const lowestHpEnemy = worstBy(livingEnemies, character => character.hp);
    const highestHpEnemy = bestBy(livingEnemies, character => character.hp);
    const highestStaminaEnemy = bestBy(livingEnemies, character => character.stamina);
    const lowestStaminaEnemy = worstBy(livingEnemies, character => character.stamina);
    const enemiesByLowestHp = [...livingEnemies].sort((left, right) => left.hp - right.hp);
    const enemiesByHighestStamina = [...livingEnemies].sort((left, right) => right.stamina - left.stamina);
    const alliesByLowestHp = [...livingAllies].sort((left, right) => left.hp - right.hp);
    const alliesByHighestStamina = [...livingAllies].sort((left, right) => right.stamina - left.stamina);
    const vulnerableEnemies = livingEnemies.filter(character => !character.isDefended);
    const defendedEnemies = livingEnemies.filter(character => character.isDefended);
    const activeEnemies = livingEnemies.filter(character => character.canAct);
    const actionEconomyLead = sources.length - activeEnemies.length;
    const hpLead = allyHpTotal - enemyHpTotal;
    const hasActionEconomyLead = actionEconomyLead > 0;
    const hasHpLead = hpLead > 0;
    const hasCastableSpells = castableSpells.length > 0;
    const hasMultiTargetSpell = multiTargetSpellOptions.length > 0;
    const canAnySourceAct = sources.length > 0;

    return {
        ...status,
        sources,
        targets,
        livingAllies,
        livingEnemies,
        fallenAllies,
        fallenEnemies,
        defendedAllies,
        undefendedAllies,
        castableSpells,
        supportSpellOptions,
        offensiveSpellOptions,
        utilitySpellOptions,
        multiTargetSpellOptions,
        singleTargetSpellOptions,
        attackOptions,
        allyById,
        enemyById,
        sourceById,
        targetById,
        castableSpellsBySourceId,
        attacksBySourceId,
        allyHpTotal,
        enemyHpTotal,
        allyHpAverage,
        enemyHpAverage,
        allyStaminaTotal,
        enemyStaminaTotal,
        lowestHpAlly,
        highestHpAlly,
        lowestHpEnemy,
        highestHpEnemy,
        highestStaminaEnemy,
        lowestStaminaEnemy,
        enemiesByLowestHp,
        enemiesByHighestStamina,
        alliesByLowestHp,
        alliesByHighestStamina,
        vulnerableEnemies,
        defendedEnemies,
        activeEnemies,
        actionEconomyLead,
        hpLead,
        hasActionEconomyLead,
        hasHpLead,
        hasCastableSpells,
        hasMultiTargetSpell,
        canAnySourceAct,
    };
}

export class AgentConnection {
    private readonly host: string;
    private readonly username: string;
    private ws?: WebSocket;
    private token?: string;
    private agentName: string;
    private secret: string;
    private agentVersion?: string;

    constructor(
        host: string,
        username: string,
        agentName: string,
        agentVersion: string,
        secret: string,
    ) {
        this.host = host.trim();
        this.username = username.trim();
        this.agentName = agentName.trim();
        this.agentVersion = agentVersion.trim();
        this.secret = secret.trim();
    }

    private ensureConnected() {
        if (!this.ws) {
            throw new Error('Not connected');
        }
    }

    /* === BASIC METHODS -- NO LOGIC === */

    send(message: ClientMessage) {
        this.ensureConnected();

        this.ws!.send(
            JSON.stringify(message),
        );
    }

    onMessage(handler: (message: ServerMessage) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            handler(
                JSON.parse(data.toString()),
            );
        });
    }

    /* === ACTIONS === */

    private async requestWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
        const token = await this.acquireToken();
        const headers = new Headers(init?.headers ?? {});
        headers.set('Authorization', `Bearer ${token}`);

        const prefix = this.host.includes('localhost') ? 'http://' : 'https://';

        const response = await fetch(`${prefix}${this.host}${path}`, {
            ...init,
            headers,
        });

        const data = await response.json() as T & { success?: boolean; error?: string };
        if (!response.ok || (data.success === false)) {
            throw new Error(data.error ?? `Request failed for ${path}`);
        }

        return data as T;
    }

    private async acquireToken(): Promise<string> {
        if (this.token) {
            return this.token;
        }

        if (!this.agentVersion?.trim()) {
            throw new Error('agentVersion is required and must be a non-empty string. Provide it in AgentConnection options.');
        }

        const prefix = this.host.includes('localhost') ? 'http://' : 'https://';
        const path = this.host.includes('localhost') ? '/auth/agent' : '/auth/agent';
        const body = {
            username: this.username?.trim(),
            agentName: this.agentName?.trim(),
            agentVersion: this.agentVersion.trim(),
            secret: this.secret?.trim(),
        };

        const response = await fetch(`${prefix}${this.host}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json() as AuthResponse;
        if (!response.ok || !data.success || !data.token) {
            console.log(response, data);
            throw new Error(data.error ?? 'Failed to acquire auth token');
        }

        this.token = data.token;
        return this.token;
    }

    async connect(): Promise<void> {
        const token = await this.acquireToken();
        const params = new URLSearchParams({
            username: this.username,
            token,
        });

        const wsUrl = this.host.includes('localhost') ? `ws://${this.host}/ws?${params.toString()}` : `wss://${this.host}/ws?${params.toString()}`;

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl);

            ws.once('open', () => {
                this.ws = ws;
                resolve();
            });

            ws.once('error', reject);
        });
    }

    disconnect() {
        this.ensureConnected();
        this.ws?.close();
    }

    setAuthToken(token: string) {
        if (!token.trim()) {
            throw new Error('token is required');
        }

        this.token = token.trim();
    }

    async listAgents() {
        const data = await this.requestWithAuth<AgentsResponse>('/agents');
        return data.agents ?? [];
    }

    async createAgent(name: string, version: string) {
        if (!name.trim()) {
            throw new Error('name is required and must be a non-empty string');
        }

        if (!version.trim()) {
            throw new Error('version is required and must be a non-empty string');
        }

        const data = await this.requestWithAuth<AuthResponse>('/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, version }),
        });

        return { agent: data.agent, version: data.version, secret: data.secret };
    }

    async createAgentVersion(agentName: string, version: string, label?: string, config?: unknown) {
        if (!agentName.trim()) {
            throw new Error('agentName is required and must be a non-empty string');
        }

        if (!version.trim()) {
            throw new Error('version is required and must be a non-empty string');
        }

        const data = await this.requestWithAuth<AgentVersionResponse>(`/agents/${agentName}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version, label, config }),
        });

        return data.version;
    }

    async rotateAgentSecret(agentName: string) {
        if (!agentName.trim()) {
            throw new Error('agentName is required and must be a non-empty string');
        }

        const data = await this.requestWithAuth<RotateSecretResponse>(`/agents/${agentName}/rotate-secret`, {
            method: 'POST',
        });

        return { agent: data.agent, secret: data.secret };
    }

    async authenticateWithSecret(agentName: string, secret: string, agentVersion?: string) {
        if (!agentName.trim()) {
            throw new Error('agentName is required and must be a non-empty string');
        }

        if (!secret.trim()) {
            throw new Error('secret is required and must be a non-empty string');
        }

        this.agentName = agentName.trim();
        this.secret = secret.trim();

        if (agentVersion?.trim()) {
            this.agentVersion = agentVersion.trim();
        }

        if (!this.agentVersion?.trim()) {
            throw new Error('agentVersion is required and must be a non-empty string. Provide it in AgentConnection options or call setAgentContext().');
        }

        const prefix = this.host.includes('localhost') ? 'http://' : 'https://';
        const response = await fetch(`${prefix}${this.host}/auth/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentName: this.agentName,
                secret,
                version: this.agentVersion.trim(),
            }),
        });

        const data = await response.json() as AuthResponse;
        if (!response.ok || !data.success || !data.token) {
            throw new Error(data.error ?? 'Failed to acquire programmatic auth token');
        }

        this.token = data.token;
        return this.token;
    }

    requestAgentStatus() {
        this.send({ type: 'status' });
    }

    joinQueue() {
        this.send({ type: 'join_queue' });
    }

    leaveQueue() {
        this.send({ type: 'leave_queue' });
    }

    requestMatchStatus(matchId: string) {
        this.send({ type: 'match_status', matchId });
    }

    joinMatch(matchId: string) {
        this.send({ type: 'join', matchId });
    }

    pickCharacter(matchId: string, characterId: string) {
        this.send({ type: 'pick', matchId, characterId });
    }

    setSpellPool(matchId: string, spellPool: string[]) {
        this.send({ type: 'set_spell_pool', matchId, spellPool });
    }

    doAction(matchId: string, action: ActionRequest) {
        this.send({ type: 'do_action', matchId, action });
    }

    /* === HOOKS === */

    /**
     * Generic prompt hook. Will fire handler any time the server prompts the agent to take an action.
     */
    onServerPrompt(handler: (message: ServerPrompt) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt') handler(message);
        });
    }

    /**
     * Fires handler, passing agent status information, when agent status is returned by the server.
     */
    onAgentStatus(handler: (status: any) => void) {
        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'status') handler(message);
        });
    }

    /**
     * Fires handler, passing matchId, when a PvP or CPU challenge is ready to be joined.
     */
    onQueuePop(handler: (matchId: string) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'join') handler(message.matchId);
        });
    }

    /**
     * Fires handler when agent is prompted to choose a character.
     */
    onCharacterPrompt(handler: (matchId: string, availableCharacters: Character[], ally: Character[], enemy: Character[]) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'pick') handler(message.matchId, message.available, message.ally, message.enemy);
        });
    }

    /**
     * Fires handler when agent is prompted to submit their shared spell pool.
     */
    onSpellsPrompt(handler: (matchId: string, availableSpells: Spell[], ally: Character[], enemy: Character[]) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'set_spell_pool') handler(message.matchId, message.available, message.ally, message.enemy);
        });
    }

    /**
     * Fires handler when match status is sent by server.
     */
    onMatchStatus(handler: (matchId: string, status: ServerStatus) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'match_status') handler(message.matchId, message.status);
        });
    }

    /**
     * Fires handler when agent is prompted to take an action in match.
     */
    onActionPrompt(handler: (matchId: string, status: ServerStatus) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'do_action') handler(message.matchId, message.status);
        });
    }

    /**
     * Fires handler when a match is completed.
     */
    onMatchOver(handler: (matchId: string, status: ServerStatus) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'match_over') handler(message.matchId, message.status);
        });
    }

    /**
     * Fires handler with error information when an error occurs.
    */
    onError(handler: (error: any) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'error') handler(message);
        });
    }
}

export default abstract class Agent {
    private username: string;
    private agentName: string;
    private agentVersion: string;
    private secret: string;
    private stayQueued: boolean;
    
    constructor(username: string, agentName: string, agentVersion: string, secret: string, stayQueued: boolean = false) {
        this.username = username;
        this.agentName = agentName;
        this.agentVersion = agentVersion;
        this.secret = secret;
        this.stayQueued = stayQueued;
    }

    abstract chooseAction(status: MatchStatus): Action | ActionRequest;
    abstract chooseCharacter(available: Character[], ally: Character[], enemy: Character[]): string | Character;
    abstract chooseSpells(available: Spell[], ally: Character[], enemy: Character[]): string[] | Spell[];

    protected connect(host = 'arena.briine.workers.dev'): AgentConnection {
        const connection = new AgentConnection(host, this.username, this.agentName, this.agentVersion, this.secret);

        connection.connect().then(() => {
            connection.onActionPrompt((matchId, status) => {
                const action = this.chooseAction(toMatchStatus(status));

                if (action.hasOwnProperty('action')) {
                    const actionWithAction = action as Action;

                    // If the action is of type Action, we need to convert it to ActionRequest
                    const correctedAction: ActionRequest = {
                        id: typeof actionWithAction.action === 'string' ? actionWithAction.action : actionWithAction.action.id,
                        type: actionWithAction.action === 'defend' ? 'defend' : (actionWithAction.action).hasOwnProperty('stackCost') ? 'spell' : 'attack',
                        source: typeof action.source === 'string' ? action.source : action.source.id,
                        target: Array.isArray(actionWithAction.target)
                            ? actionWithAction.target.map(t => typeof t === 'string' ? t : t.id)
                            : (actionWithAction.target ? [typeof actionWithAction.target === 'string' ? actionWithAction.target : actionWithAction.target.id] : undefined),
                    };
                    console.log(correctedAction);
                    connection.doAction(matchId, correctedAction);
                } else {
                    // If the action is already of type ActionRequest, we can use it directly
                    connection.doAction(matchId, action as ActionRequest);
                }
            });

            connection.onCharacterPrompt((matchId, available, ally, enemy) => {
                const character = this.chooseCharacter(available, ally, enemy);
                if (typeof character === 'string') {
                    connection.pickCharacter(matchId, character);
                } else {
                    connection.pickCharacter(matchId, character.id);
                }
            });

            connection.onSpellsPrompt((matchId, available, ally, enemy) => {
                const spellPool = this.chooseSpells(available, ally, enemy);
                const correctedSpellPool = spellPool.map(s => typeof s === 'string' ? s : s.id);
                connection.setSpellPool(matchId, correctedSpellPool);
            });

            connection.onQueuePop((matchId) => {
                console.log(`Joining match ${matchId}...`);
                connection.joinMatch(matchId);
            });

            connection.onMatchOver((matchId, status) => {
                console.log(`Match ${matchId} is over. Final status:`, status);
                if (this.stayQueued) {
                    connection.joinQueue();
                } else {
                    connection.disconnect();
                    process.exit(0);
                }
            });

            connection.onError((error) => {
                console.error('Agent encountered an error:', error);
            });

            connection.joinQueue();
        }).catch((error) => {
            console.error('Failed to connect to the server:', error);
        });

        return connection;
    }

    static register(agent: Agent, host?: string) {
        return agent.connect(host);
    }
}
