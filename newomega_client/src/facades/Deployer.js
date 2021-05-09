import _ from 'underscore';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import { blake2AsU8a, blake2AsHex } from '@polkadot/util-crypto';
import { compactAddLength } from '@polkadot/util';
import { ContractFacade } from './ContractFacade';

const ENDOWMENT = 1000000000000000n;
const GAS_LIMIT = 100000n * 10000000n;
const BLOCK_LENGTH = 6000;
const MNEMONIC = '//Alice';

const fs = require('fs');
const util = require('util');
const path = require('path');
const readFile = util.promisify(fs.readFile);

export class Deployer {
    async initialize() {
        this.contractFacade = new ContractFacade();
        await this.contractFacade.initialize(MNEMONIC);
    }

    getWasmFilename(contract, isDelegator) {
        return isDelegator
            ? path.resolve(__dirname, `../ink/${contract}.wasm`)
            : path.resolve(__dirname, `../ink/${contract}/${contract}.wasm`);
    }

    getAbiFilename(contract, isDelegator) {
        return isDelegator
            ? path.resolve(__dirname, `../ink/metadata.json`)
            : path.resolve(__dirname, `../ink/${contract}/metadata.json`);
    }

    async deployInnerContract(contract, params = []) {
        return new Promise(async (resolve, reject) => {
            const abi = require(this.getAbiFilename(contract));
            const wasm = await readFile(this.getWasmFilename(contract));
            const code = new CodePromise(this.contractFacade.api, abi, wasm);
            // const salt = Uint8Array.from(Math.floor(Math.random() * Number.MAX_VALUE).toString());
            // const options = {
            //     gasLimit: GAS_LIMIT,
            //     value: ENDOWMENT,
            //     salt,
            // };

            const unsub = await code.tx
                .new(ENDOWMENT, GAS_LIMIT, ...params)
                .signAndSend(this.contractFacade.alice, (result) => {
                if (result.status.isInBlock || result.status.isFinalized) {
//                  contract = result.contract;
                    unsub();
                    resolve(code.code);
                }
            });

//             const blueprint = new BlueprintPromise(this.contractFacade.api, abi, code.code);

//             const unsub = await blueprint.tx
//               .new(ENDOWMENT, GAS_LIMIT)
//               .signAndSend(this.contractFacade.alice, (result) => {
//                 if (result.status.isInBlock || result.status.isFinalized) {
// //                  contract = result.contract;
//                   unsub();
//                   resolve(code.code);
//                 }
//               });

            // let blueprint;
            // const unsub = await code
            //     .createBlueprint()
            //     .signAndSend(this.contractFacade.alice, (result) => {
            //         if (result.status.isInBlock || result.status.isFinalized) {
            //             blueprint = result.blueprint;
            //             unsub();

            //             let contract;
            //             const unsubI = blueprint.tx
            //                 .new(ENDOWMENT, GAS_LIMIT)
            //                 .signAndSend(this.contractFacade.alice, (resultI) => {
            //                     if (result.status.isInBlock || result.status.isFinalized) {
            //                         unsubI();
            //                         resolve(result.contract);
            //                     }
            //                 });
            //         }
            //     });

            // const blueprint = new BlueprintPromise(this.contractFacade.api, abi, code.code)

            // await code.instantiate('new', options, null)
            //     .signAndSend(this.contractFacade.alice, (result) => {
            //         if (result.status.isInBlock || result.status.isFinalized) {
            //             resolve(code.code);
            //         }
            //     });

            // const unsub = await this.contractFacade.api.tx.contracts
            //     .instantiateWithCode(ENDOWMENT, GAS_LIMIT, compactAddLength(code.code), null, salt)
            //     .signAndSend(this.contractFacade.alice, (result) => {
            //         if (result.status.isInBlock || result.status.isFinalized) {
            //             resolve(code.code);
            //         }
            //     });
        });
    }

    deployDelegator() {
        return new Promise(async (resolve, reject) => {
            const hashes = {};

            hashes['newomega'] = await this.deployInnerContract('newomega');
            console.log('codehashes.newomega ', blake2AsHex(hashes['newomega']));

            hashes['newomegagame'] = await this.deployInnerContract('newomegagame', [null]);
            console.log('codehashes.newomegagame ', blake2AsHex(hashes['newomegagame']));

            hashes['newomegastorage'] = await this.deployInnerContract('newomegastorage');
            console.log('codehashes.newomegastorage ', blake2AsHex(hashes['newomegastorage']));

            hashes['newomegaranked'] = await this.deployInnerContract('newomegaranked', [null, null]);
            console.log('codehashes.newomegaranked ', blake2AsHex(hashes['newomegaranked']));

            hashes['newomegarewarder'] = await this.deployInnerContract('newomegarewarder', [null]);
            console.log('codehashes.newomegarewarder ', blake2AsHex(hashes['newomegarewarder']));

            const delegatorAbi = require('../ink/metadata.json');
            const delegatorWasm = await readFile(this.getWasmFilename('newomegadelegator', true));
            const code = new CodePromise(this.contractFacade.api, delegatorAbi,
                delegatorWasm);
            const version = Math.floor(Math.random() * 1000000);
            // const salt = Uint8Array.from(Math.floor(Math.random() * Number.MAX_VALUE).toString());

            const unsub = await code.tx
                .new(ENDOWMENT * 10n, GAS_LIMIT, version, blake2AsHex(hashes.newomega),
                    blake2AsHex(hashes.newomegastorage),
                    blake2AsHex(hashes.newomegagame),
                    blake2AsHex(hashes.newomegaranked),
                    blake2AsHex(hashes.newomegarewarder))
                .signAndSend(this.contractFacade.alice, (result) => {
                    if (result.status.isInBlock || result.status.isFinalized) {
                        unsub();
                        resolve(result.contract);
                    }
                });


                // const ctorParams = [version, hashes.newomega, hashes.newomegastorage, hashes.newomegagame,
                //     hashes.newomegaranked, hashes.newomegarewarder];
                // const params = code.abi.findConstructor('new').toU8a(ctorParams);
                // const unsub = await this.contractFacade.api.tx.contracts
                //     .instantiateWithCode(ENDOWMENT * 10n, GAS_LIMIT, compactAddLength(code.code),
                //         params, salt)
                //     .signAndSend(this.contractFacade.alice, (result) => {
                //         if (result.status.isInBlock || result.status.isFinalized) {
                //             resolve(result);
                //         }
                //     });
        });
    }
}
