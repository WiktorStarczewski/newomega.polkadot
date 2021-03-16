import { ApiPromise, WsProvider, Keyring, Codec } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { hexToU8a, isHex, stringToU8a, stringToHex, compactAddLength } from '@polkadot/util';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import delegatorAbi from '../abi/newomegadelegator.json';
import _ from 'underscore';


const RPC_PROVIDER = 'ws://127.0.0.1:9944'; // wss://rpc.polkadot.io
const DELEGATOR_CONTRACT_ADDRESS = '5DHqrc6dVfSB1PpS4FDed842GMXMVU76yG7hZGUG1JG6sevh';
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
            // types: { "Address": "MultiAddress", "LookupSource": "MultiAddress" },
            types: { "Address": "AccountId", "LookupSource": "AccountId" },
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
        // const _selection = this.api.createType('[u8;4]', [1,1,1,1]); //new Uint8Array(selection); //this.api.createType('[u8;4]', selection);
        // const _variants = this.api.createType('[u8;4]', [1,1,1,1]); //new Uint8Array(variants); // this.api.createType('[u8;4]', variants);
        // const _commander = this.api.createType('u8', commander);
//        const _name = this.api.createType('Text', name);

//        const _name = compactAddLength(stringToU8a(name));

        // console.log('  @@ ', _name);

        // const _selection = new Uint8Array(selection);
        // const _variants = new Uint8Array(variants);

        // const _selection = new Uint8Array(4);
        // _selection.set([1, 1, 1, 1]);

        // const _variants = new Uint8Array(4);
        // _variants.set([1, 1, 1, 1]);

        // const __selection = this.api.registry.createType('[u8;4]', selection);
        // const __variants = this.api.registry.createType('[u8;4]', variants);

        // const __selection = {
        //     isValid: true,
        //     value: selection,
        // };

        // const __variants = {
        //     isValid: true,
        //     value: variants,
        // };


        // const abiMessage = _.findWhere(this.contracts.delegator.abi.messages, {
        //     identifier: 'register_defence'
        // });
        // console.log('   ## ', abiMessage.args[0]);

        // // const ___selection = abiMessage.toU8a(__selection);
        // // const ___variants = abiMessage.toU8a(__variants);

        // console.log('  !! ', __selection.toU8a());

        // console.log('  ## ', this.contracts.delegator.tx.registerDefence);

        await this.contracts.delegator.tx
            .registerDefence({ value: 0, gasLimit: GAS_LIMIT },
                selection, variants,
                commander,
                name)
            .signAndSend(this.alice)
    }

    async getOwnDefence() {
        // eslint-disable-next-line no-unused-vars
        const { gasConsumed, result, outcome } =
            await this.contracts.delegator.query
                .getOwnDefence(this.alice.address, { value: 0, gasLimit: GAS_LIMIT });

        return outcome; // TODO result/outcome ?
    }
}
