import _ from 'underscore';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import { blake2AsU8a, blake2AsHex } from '@polkadot/util-crypto';
import { compactAddLength } from '@polkadot/util';
import { ContractFacade } from './ContractFacade';

const ENDOWMENT = 100n;
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

    async deployInnerContract(contract) {
        return new Promise(async (resolve, reject) => {
            const abi = require(this.getAbiFilename(contract));
            const wasm = await readFile(this.getWasmFilename(contract));
            const code = await new CodePromise(this.contractFacade.api, abi, wasm);
            const salt = 0; //Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

            const unsub = await this.contractFacade.api.tx.contracts
                .instantiateWithCode(ENDOWMENT, GAS_LIMIT, compactAddLength(code.code), null, salt)
                .signAndSend(this.contractFacade.alice, (result) => {
                    if (result.status.isInBlock || result.status.isFinalized) {
                        resolve(code.code);
                    }
                });
        });
    }

    deployDelegator() {
        return new Promise(async (resolve, reject) => {
            const hashes = {};

            hashes['newomega'] = await this.deployInnerContract('newomega');
            console.log('hashes.newomega ', blake2AsHex(hashes['newomega']));

            hashes['newomegagame'] = await this.deployInnerContract('newomegagame');
            console.log('hashes.newomegagame ', blake2AsHex(hashes['newomegagame']));

            hashes['newomegaranked'] = await this.deployInnerContract('newomegaranked');
            console.log('hashes.newomegaranked ', blake2AsHex(hashes['newomegaranked']));

            hashes['newomegarewarder'] = await this.deployInnerContract('newomegarewarder');
            console.log('hashes.newomegarewarder ', blake2AsHex(hashes['newomegarewarder']));

            hashes['newomegastorage'] = await this.deployInnerContract('newomegastorage');
            console.log('hashes.newomegastorage ', blake2AsHex(hashes['newomegastorage']));

            const delegatorAbi = require('../ink/metadata.json');
            fs.readFile(this.getWasmFilename('newomegadelegator', true), async (err, delegatorWasm) => {
                const code = await new CodePromise(this.contractFacade.api, delegatorAbi,
                    delegatorWasm);
                const unsub = await this.contractFacade.api.tx.contracts
                    .instantiateWithCode(ENDOWMENT, GAS_LIMIT, compactAddLength(code.code),
                        [hashes.newomega, hashes.newomegastorage, hashes.newomegagame,
                        hashes.newomegaranked, hashes.newomegarewarder], salt)
                    .signAndSend(this.contractFacade.alice, (result) => {
                        if (result.status.isInBlock || result.status.isFinalized) {
                            resolve(result);
                        }
                    });
            });
        });
    }
}
