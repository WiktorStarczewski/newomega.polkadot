import { ApiPromise, WsProvider, Keyring, Codec } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { hexToU8a, isHex, stringToU8a, stringToHex, compactAddLength } from '@polkadot/util';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import delegatorAbi from '../ink/metadata.json';
import _ from 'underscore';


const RPC_PROVIDER = 'ws://127.0.0.1:9944'; // wss://rpc.polkadot.io
const DELEGATOR_CONTRACT_ADDRESS = '5GM8tFEynFkrhDrSJNvvMFBDcFNN4Ks7E4UM7rBZDXcVsTuB';
const GAS_LIMIT = -1;//30000n * 1000000n;


export class ContractFacade {
    async initialize(mnemonic) {
        this.api = await this.getApi();
        this.keyring = new Keyring({ type: 'sr25519' });
        this.alice = this.keyring.addFromUri(mnemonic, { name: 'Alice' });
        this.contracts = {
            delegator: this.getDelegator(),
        };
    }

    getDelegator() {
        return new ContractPromise(this.api,
            delegatorAbi, decodeAddress(DELEGATOR_CONTRACT_ADDRESS));
    }

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

    async subscribeToBalance(subscriber) {
        return this.api && this.api.query.system.account(this.alice.address, subscriber);
    }

    async subscribeNewHeads(handler) {
        return this.api && this.api.rpc.chain.subscribeNewHeads(handler);
    }

    async registerDefence(selection, variants, commander, name) {
        return this.contracts.delegator.tx
            .registerDefence({ value: 0, gasLimit: GAS_LIMIT },
                selection,
                variants,
                commander,
                name)
            .signAndSend(this.alice);
    }

    async getOwnDefence() {
        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .getOwnDefence(this.alice.address, { value: 0, gasLimit: GAS_LIMIT });

            if (result.isOk) {
                const defence = output && output.toHuman();
                defence.selection = Uint8Array.from(hexToU8a(defence.selection));
                defence.variants = Uint8Array.from(hexToU8a(defence.variants));
                defence.commander = parseInt(defence.commander, 10);

                resolve(defence);
            } else {
                resolve(result.asErr);
            }
        });
    }

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
                        selection: Uint8Array.from(hexToU8a(defender[1].selection)),
                        variants: Uint8Array.from(hexToU8a(defender[1].variants)),
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

    async attack(target, selection, variants, commander) {
        return this.contracts.delegator.tx
            .attack({ value: 0, gasLimit: GAS_LIMIT },
                target,
                selection,
                variants,
                commander)
            .signAndSend(this.alice);
    }

    async getLeaderboard() {
        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .getLeaderboard(this.alice.address, { value: 0, gasLimit: GAS_LIMIT });

            if (result.isOk) {
                const leaderboard = output && output.toHuman();
                _.each(leaderboard, (entry) => {
                    entry[1].ranked_wins = parseInt(entry[1].ranked_wins, 10);
                    entry[1].ranked_losses = parseInt(entry[1].ranked_losses, 10);
                });
                resolve(leaderboard);
            } else {
                resolve(result.asErr);
            }
        });
    }

    async replay(seed, selectionLhs, selectionRhs, variantsLhs, variantsRhs,
        commanderLhs, commanderRhs) {

        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { _gasConsumed, result, output } =
                await this.contracts.delegator.query
                    .replay(this.alice.address, { value: 0, gasLimit: GAS_LIMIT },
                        seed,
                        selectionLhs,
                        selectionRhs,
                        variantsLhs,
                        variantsRhs,
                        commanderLhs,
                        commanderRhs
                    );

            if (result.isOk) {
                const fightResult = {
                    ...output[0].toHuman(),
                    lhs_moves: output[1].unwrap().toHuman(),
                    rhs_moves: output[2].unwrap().toHuman(),
                };

                fightResult.selection_lhs = Uint8Array.from(hexToU8a(fightResult.selection_lhs));
                fightResult.selection_rhs = Uint8Array.from(hexToU8a(fightResult.selection_rhs));
                fightResult.variants_lhs = Uint8Array.from(hexToU8a(fightResult.variants_lhs));
                fightResult.variants_rhs = Uint8Array.from(hexToU8a(fightResult.variants_rhs));
                fightResult.ships_lost_lhs = Uint8Array.from(hexToU8a(fightResult.ships_lost_lhs));
                fightResult.ships_lost_rhs = Uint8Array.from(hexToU8a(fightResult.ships_lost_rhs));
                fightResult.commander_lhs = parseInt(fightResult.commander_lhs, 10);
                fightResult.commander_rhs = parseInt(fightResult.commander_rhs, 10);
                fightResult.rounds = parseInt(fightResult.rounds, 10);
                fightResult.seed = parseInt(fightResult.seed, 10);

                _.each(fightResult.lhs_moves, (move) => {
                    _.each(['move_type', 'round', 'source',
                        'target', 'target_position', 'damage'], (prop) => {

                        move[prop] = parseInt(move[prop], 10);
                    });
                });

                _.each(fightResult.rhs_moves, (move) => {
                    _.each(['move_type', 'round', 'source',
                        'target', 'target_position', 'damage'], (prop) => {

                        move[prop] = parseInt(move[prop], 10);
                    });
                });

                resolve(fightResult);
            } else {
                resolve(result.asErr);
            }
        });
    }
}
