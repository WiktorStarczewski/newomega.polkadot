# NewOmega Client / Polkadot

The game client for NewOmega, integrated into the Polkadot/Ink stack.

## Installation

```yarn install```

### Prerequisites

1. For building the contracts, ```rustup nightly``` chain nightly-2021-02-25-x86_64-apple-darwin was used.
2. Local node (```cargo run --locked -- --dev```).
3. For deploying the contracts, manual method via the https://polkadot.js.org/apps interface is preferred, as it is currently very volatile otherwise. Please consult the documentation of the contracts for more info on the deployment.
4. The tests assume the existance of Alice and Bob accounts, and some balance in them (enough to run the contracts). That is currently automatic when creating a local node via ```cargo```, but should be noted in other caes.

### Assigning the Delegator contract
After deployment of the contracts, the Delegator contracts address needs to be configured before the bundle is built. Having obtained the address, run


```yarn run genconfig address```

(eg. ```yarn run genconfig 5CGnwU4hpx2qXxxt2vr7Phg3Zch5YKMkq7kzyi2j1iojq5oX```)


That will update the config file with the address.

## Testing

```yarn test --all```


Two test suites are available, ```App.test``` and ```ContractFacade.test```.
App.test is responsible for UI testing, whereas ContractFacade.test focuses on the smart contract interactions.

## Running

```yarn start```

Will start a local webpack development server, and open a browser window with the game in local development.

# Architecture
