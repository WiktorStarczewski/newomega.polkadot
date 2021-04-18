import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { decodeAddress } from '@polkadot/keyring';
import { hexToU8a } from '@polkadot/util';
import { ContractPromise } from '@polkadot/api-contract';
import delegatorAbi from '../ink/metadata.json';
import config from '../config/config.json';
import _ from 'underscore';


const RPC_PROVIDER = 'ws://127.0.0.1:9944'; // wss://rpc.polkadot.io
const GAS_LIMIT = -1; // 30000n * 1000000n;


export class ContractFacade {
    /**
     * Initializes the Facade with a mnemonic.
     * Instantiates a Keyring, exposes Alice account, and loads the contract.
     */
    async initialize(mnemonic) {
        this.api = await this.getApi();
        this.keyring = new Keyring({ type: 'sr25519' });
        this.alice = this.keyring.addFromUri(mnemonic, { name: 'NewOmega' });
        this.contracts = {
            delegator: this.getDelegator(),
        };
    }

    /**
     * Returns the main Delegator contract promise.
     */
    getDelegator() {
        return new ContractPromise(this.api,
            delegatorAbi, decodeAddress(config.delegator_address));
    }

    /**
     * Instantiates the API, according to the default provider.
     * Waits until the API becomes ready.
     */
    async getApi() {
        const wsProvider = new WsProvider(RPC_PROVIDER);
        const api = ApiPromise.create({
            provider: wsProvider,
            types: { "Address": "MultiAddress", "LookupSource": "MultiAddress" },
            //types: { "Address": "AccountId", "LookupSource": "AccountId" },
        });
        await api.isReady;
        return api;
    }

    /**
     * Subscribes to balance changes for Alice according to the passed subscriber.
     */
    async subscribeToBalance(subscriber) {
        return this.api && this.api.query.system.account(this.alice.address, subscriber);
    }

    /**
     * Subscribes to new heads.
     */
    async subscribeNewHeads(handler) {
        return this.api && this.api.rpc.chain.subscribeNewHeads(handler);
    }

    /**
     * Registers a defence for player.
     */
    async registerDefence(selection, variants, commander, name) {
        return this.contracts.delegator.tx
            .registerDefence({ value: 0, gasLimit: GAS_LIMIT },
                this.ensureUint8Array(selection),
                this.ensureUint8Array(variants),
                commander,
                name)
            .signAndSend(this.alice);
    }

    /**
     * Registers the registered defence for current player.
     */
    async getOwnDefence() {
        return new Promise(async (resolve, reject) => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .getOwnDefence(this.alice.address, { value: 0, gasLimit: GAS_LIMIT });

            if (result.isOk) {
                const defence = output && output.toHuman();
                defence.selection = Array.from(Uint8Array.from(hexToU8a(defence.selection)));
                defence.variants = Array.from(Uint8Array.from(hexToU8a(defence.variants)));
                defence.commander = parseInt(defence.commander, 10);

                resolve(defence);
            } else {
                reject(result.asErr);
            }
        });
    }

    /**
     * Returns all the players who have registered their defences.
     */
    async getAllDefenders() {
        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .getAllDefenders(this.alice.address, { value: 0, gasLimit: GAS_LIMIT });

            if (result.isOk) {
                const defenders = output && output.toHuman();
                const defendersParsed = _.map(defenders, (defender) => {
                    return {
                        address: defender[0],
                        selection: Array.from(Uint8Array.from(hexToU8a(defender[1].selection))),
                        variants: Array.from(Uint8Array.from(hexToU8a(defender[1].variants))),
                        commander: parseInt(defender[1].commander, 10),
                        name: defender[1].name,
                    };
                });

                resolve(defendersParsed);
            } else {
                resolve(result.asErr);
            }
        });
    }

    /**
     * Helper function to ensure a Uint8Array
     */
    ensureUint8Array(obj) {
        return obj instanceof Uint8Array
            ? obj
            : Uint8Array.from(obj);
    }

    /**
     * Attacks another player's registered defence.
     */
    async attack(target, selection, variants, commander) {
        selection = this.ensureUint8Array(selection);
        variants = this.ensureUint8Array(variants);

        return new Promise(async resolve => {
            this.contracts.delegator.tx
                .attack({ value: 0, gasLimit: GAS_LIMIT },
                    target,
                    selection,
                    variants,
                    commander)
                .signAndSend(this.alice, (result) => {
                    if (result.status.isInBlock || result.status.isFinalized) {
                        const event = result.contractEvents && result.contractEvents[0];
                        const resultMap = event && event.args && event.args[2];
                        resolve(resultMap);
                    }
                });
        });
    }

    /**
     * Returns the current leaderboard.
     */
    async getLeaderboard() {
        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .getLeaderboard(this.alice.address, { value: 0, gasLimit: GAS_LIMIT });

            if (result.isOk) {
                const leaderboard = output && output.toHuman();
                const leaderboardParsed = _.map(leaderboard, (entry) => {
                    return {
                        address: entry[0],
                        ranked_wins: parseInt(entry[1].ranked_wins, 10),
                        ranked_losses: parseInt(entry[1].ranked_losses, 10),
                    }
                });

                resolve(leaderboardParsed);
            } else {
                resolve(result.asErr);
            }
        });
    }

    _humanizeFightResult(fightResult) {
        _.each(['lhs_moves', 'rhs_moves'], (movesType) => {
            _.each(fightResult[movesType], (move) => {
                _.each(['move_type', 'round', 'source', 'target',
                    'target_position', 'damage'], (prop) => {
                    move[prop] = parseInt(move[prop], 10);
                });
            });
        });

        return fightResult;
    }

    /**
     * Replays a fight according to a seed.
     */
    async replay(seed, selectionLhs, selectionRhs, variantsLhs, variantsRhs,
        commanderLhs, commanderRhs) {

        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .replay(this.alice.address, { value: 0, gasLimit: GAS_LIMIT },
                        seed,
                        this.ensureUint8Array(selectionLhs),
                        this.ensureUint8Array(selectionRhs),
                        this.ensureUint8Array(variantsLhs),
                        this.ensureUint8Array(variantsRhs),
                        commanderLhs,
                        commanderRhs
                    );

            if (result.isOk) {
                const fightResult = {
                    ...output[0].toHuman(),
                    lhs_moves: output[1].unwrap().toHuman(),
                    rhs_moves: output[2].unwrap().toHuman(),
                };

                this._humanizeFightResult(fightResult);

                fightResult.selection_lhs = Array.from(Uint8Array.from(hexToU8a(fightResult.selection_lhs)));
                fightResult.selection_rhs = Array.from(Uint8Array.from(hexToU8a(fightResult.selection_rhs)));
                fightResult.variants_lhs = Array.from(Uint8Array.from(hexToU8a(fightResult.variants_lhs)));
                fightResult.variants_rhs = Array.from(Uint8Array.from(hexToU8a(fightResult.variants_rhs)));
                fightResult.ships_lost_lhs = Array.from(Uint8Array.from(hexToU8a(fightResult.ships_lost_lhs)));
                fightResult.ships_lost_rhs = Array.from(Uint8Array.from(hexToU8a(fightResult.ships_lost_rhs)));
                fightResult.commander_lhs = parseInt(fightResult.commander_lhs, 10);
                fightResult.commander_rhs = parseInt(fightResult.commander_rhs, 10);
                fightResult.rounds = parseInt(fightResult.rounds, 10);
                fightResult.seed = parseInt(fightResult.seed, 10);

                resolve(fightResult);
            } else {
                resolve(result.asErr);
            }
        });
    }

    // Under development.
    // Currently blocked by the events data not being
    // correctly deserialized by polkadot.js.
    async getRankedFightCompleteEvents() {
        console.log(this.contracts.delegator.query);

        const lastHdr = await this.api.rpc.chain.getHeader();
        const delta = 10000;
        const startHdr = await this.api.rpc.chain.getBlockHash(lastHdr - delta);
        const events = await this.contracts.delegator.api.query.system.events.range([startHdr]);

        events.forEach(([hash, values]) => {
            _.each(values, (value) => {
                const event = value.event.toHuman();
                if (event.method === 'ContractEmitted') {
                    console.log(event.data[1], value);
                }
            })
        });
    }
}
