import { ApiPromise, WsProvider, Keyring, Codec } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { hexToU8a, isHex, stringToU8a, stringToHex, compactAddLength } from '@polkadot/util';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import delegatorAbi from '../ink/metadata.json';
import _ from 'underscore';


const RPC_PROVIDER = 'ws://127.0.0.1:9944'; // wss://rpc.polkadot.io
const DELEGATOR_CONTRACT_ADDRESS = '5FJ5DSShj4QPrwAoMrVfQaeMqJTqEBxs28cKaDjPs2YJKyua';
const GAS_LIMIT = -1;//30000n * 1000000n;


export class ContractFacade {
    async initialize(mnemonic) {
        this.api = await this.getApi();
        this.keyring = new Keyring({ type: 'sr25519' });
        this.alice = this.keyring.addFromUri('//Alice', { name: 'Alice' });
            //.addFromUri(mnemonic);
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
                selection, variants,
                commander,
                name)
            .signAndSend(this.alice)
    }

    getOwnDefence() {
        return new Promise(async resolve => {
            //eslint-disable-next-line no-unused-vars
            const { gasConsumed, result, output } =
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
}
