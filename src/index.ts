import WebSocket from 'ws';

export type Stack = {
    red:    number;
    blue:   number;
    green:  number;
    yellow: number;
    white:  number;
    black:  number;
    purple: number;
    orange: number;
};

export type ActionRequest = {
    id: string,
    type: string,
    source: string,
    target?: string[],
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
    attacks: { id: string, name: string, element: string }[],
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
    effects: { name: string, description: string }[],
    description: string,
    available?: boolean
};

export type GameStatus = {
    ally: Ally[],
    enemy: Character[],
    stack: Stack,
};

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

    requestGameStatus(gameId: string) {
        this.send({ type: 'game_status', gameId });
    }

    joinGame(gameId: string) {
        this.send({ type: 'join', gameId });
    }

    pickCharacter(gameId: string, characterId: string) {
        this.send({ type: 'pick', gameId, characterId });
    }

    setSpellPool(gameId: string, spellPool: string[]) {
        this.send({ type: 'set_spell_pool', gameId, spellPool });
    }

    doAction(gameId: string, action: ActionRequest) {
        this.send({ type: 'do_action', gameId, action });
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
     * Fires handler, passing gameId, when a PvP or CPU challenge is ready to be joined.
     */
    onQueuePop(handler: (gameId: string) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'join') handler(message.gameId);
        });
    }

    /**
     * Fires handler when agent is prompted to choose a character.
     */
    onCharacterPrompt(handler: (gameId: string, availableCharacters: Character[], ally: Character[], enemy: Character[]) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'pick') handler(message.gameId, message.available, message.ally, message.enemy);
        });
    }

    /**
     * Fires handler when agent is prompted to submit their shared spell pool.
     */
    onSpellsPrompt(handler: (gameId: string, availableSpells: Spell[], ally: Character[], enemy: Character[]) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'set_spell_pool') handler(message.gameId, message.available, message.ally, message.enemy);
        });
    }

    /**
     * Fires handler when game status is sent by server.
     */
    onGameStatus(handler: (gameId: string, status: GameStatus) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'game_status') handler(message.gameId, message.status);
        });
    }

    /**
     * Fires handler when agent is prompted to take an action in game.
     */
    onActionPrompt(handler: (gameId: string, status: GameStatus) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'prompt' && message.action === 'do_action') handler(message.gameId, message.status);
        });
    }

    /**
     * Fires handler when a game is completed.
     */
    onGameOver(handler: (gameId: string, status: GameStatus) => void) {
        this.ensureConnected();

        this.ws!.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.type === 'game_over') handler(message.gameId, message.status);
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

    abstract act(status: GameStatus): ActionRequest;
    abstract chooseCharacter(availableCharacters: Character[], ally: Character[], enemy: Character[]): string;
    abstract chooseSpells(available: Spell[], ally: Character[], enemy: Character[]): string[];

    protected connect(host = 'arena.briine.workers.dev'): AgentConnection {
        const connection = new AgentConnection(host, this.username, this.agentName, this.agentVersion, this.secret);

        connection.connect().then(() => {
            connection.onActionPrompt((gameId, status) => {
                const action = this.act(status);
                connection.doAction(gameId, action);
            });

            connection.onCharacterPrompt((gameId, availableCharacters, ally, enemy) => {
                const characterId = this.chooseCharacter(availableCharacters, ally, enemy);
                connection.pickCharacter(gameId, characterId);
            });

            connection.onSpellsPrompt((gameId, available, ally, enemy) => {
                const spellPool = this.chooseSpells(available, ally, enemy);
                connection.setSpellPool(gameId, spellPool);
            });

            connection.onQueuePop((gameId) => {
                console.log(`Joining game ${gameId}...`);
                connection.joinGame(gameId);
            });

            connection.onGameOver((gameId, status) => {
                console.log(`Game ${gameId} is over. Final status:`, status);
                if (this.stayQueued) {
                    connection.joinQueue();
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
