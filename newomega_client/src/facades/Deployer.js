import _ from 'underscore';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import { blake2AsU8a, blake2AsHex } from '@polkadot/util-crypto';
import { compactAddLength } from '@polkadot/util';
import { ContractFacade } from './ContractFacade';

const ENDOWMENT = 100n;
const GAS_LIMIT = 100000n * 10000000n;
const BLOCK_LENGTH = 6000;


const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

export class Deployer {
    async initialize() {
        this.contractFacade = new ContractFacade();
        await this.contractFacade.initialize();
    }

    getWasmFilename(contract, isDelegator) {
        // IMROVEME relative path
        return isDelegator
            ? `/Users/wiktor/projects/newomega-substrate/newomega_client/src/ink/${contract}.wasm`
            : `/Users/wiktor/projects/newomega-substrate/newomega_client/src/ink/${contract}/${contract}.wasm`;
    }

    getAbiFilename(contract, isDelegator) {
        // IMROVEME relative path
        return isDelegator
            ? `../ink/metadata.json`
            : `../ink/${contract}/metadata.json`;
    }

    async deployInnerContract(contract) {
        const abi = require(this.getAbiFilename(contract));
        const wasm = await readFile(this.getWasmFilename(contract));
        const code = await new CodePromise(this.contractFacade.api, abi, wasm);

        const unsub = await this.contractFacade.api.tx.contracts
            .instantiateWithCode(ENDOWMENT, GAS_LIMIT, compactAddLength(code.code), salt)
            .signAndSend(this.contractFacade.alice);

        return code.code;
    }

    deployDelegator() {
        return new Promise(async (resolve, reject) => {
            const hashes = {};

            hashes['newomega'] = await this.deployInnerContract('newomega');

            console.log('hashes.newomega ', blake2AsHex(hashes['newomega']));
            await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

            hashes['newomegagame'] = await this.deployInnerContract('newomegagame');

            console.log('hashes.newomegagame ', blake2AsHex(hashes['newomegagame']));
            await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

            hashes['newomegaranked'] = await this.deployInnerContract('newomegaranked');

            console.log('hashes.newomegaranked ', blake2AsHex(hashes['newomegaranked']));
            await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

            hashes['newomegarewarder'] = await this.deployInnerContract('newomegarewarder');

            console.log('hashes.newomegarewarder ', blake2AsHex(hashes['newomegarewarder']));
            await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

            hashes['newomegastorage'] = await this.deployInnerContract('newomegastorage');

            console.log('hashes.newomegastorage ', blake2AsHex(hashes['newomegastorage']));
            await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

            const delegatorAbi = require('../ink/metadata.json');

            fs.readFile(this.getWasmFilename('newomegadelegator', true), async (err, delegatorWasm) => {
                const code = await new CodePromise(this.contractFacade.api, delegatorAbi,
                    delegatorWasm);
                const codeResult = await this.contractFacade.api.tx.contracts
                    .putCode(compactAddLength(code.code))
                    .signAndSend(this.contractFacade.alice);
                await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

                const codeHash = blake2AsHex(code.code);

                console.log('codeResult ', codeResult);
                console.log('hashes.newomegadelegator ', codeHash);

                resolve(codeHash);
            });
        });
    }
}
