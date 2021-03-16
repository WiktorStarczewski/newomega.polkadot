import _ from 'underscore';
import { ContractPromise, CodePromise, BlueprintPromise } from '@polkadot/api-contract';
import { blake2AsU8a, blake2AsHex } from '@polkadot/util-crypto';
import { ContractFacade } from './ContractFacade';

const ENDOWMENT = 100000n;
const GAS_LIMIT = 100000n * 10000000n;

const fs = require('fs');

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

        return new Promise((resolve, reject) => {
            fs.readFile(this.getWasmFilename(contract), async (err, wasm) => {
                const code = await new CodePromise(this.contractFacade.api, abi, wasm);
                const codeHash = blake2AsHex(code.code);
                resolve(codeHash);
            });
        });
    }

    deployDelegator() {
        return new Promise((resolve, reject) => {
            const allInners = ['newomega', 'newomegagame', 'newomegaranked',
                'newomegarewarder', 'newomegastorage'];
            const hashes = {};
            const promises = _.map(allInners, (innerContract) => {
                return this.deployInnerContract(innerContract).then((codeHash) => {
                    hashes[innerContract] = codeHash;
                });
            });

            Promise.all(promises).then(() => {
                const delegatorAbi = require('../ink/metadata.json');

                fs.readFile(this.getWasmFilename('newomegadelegator', true), async (err, delegatorWasm) => {
                    const code = await new CodePromise(this.contractFacade.api, delegatorAbi,
                        delegatorWasm);

                    const codeHash = blake2AsHex(code.code);
                    const blueprint = await new BlueprintPromise(this.contractFacade.api, delegatorAbi,
                        codeHash);

                    const unsub = await blueprint.tx
                        .new(ENDOWMENT, GAS_LIMIT,
                            0,
                            hashes.newomega,
                            hashes.newomegastorage,
                            hashes.newomegagame,
                            hashes.newomegaranked,
                            hashes.newomegarewarder
                        )
                        .signAndSend(this.contractFacade.alice, (result) => {
                            if (result.status.isInBlock || result.status.isFinalized) {
                                console.log('Contract: ', result.contract);
                                unsub();
                                resolve(result.contract);
                            }
                        });
                });
            });
        });
    }
}
