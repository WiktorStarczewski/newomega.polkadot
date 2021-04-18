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

*Please note assigning the contract address is needed for both tests and the client itself.*

## Testing

```yarn test --all```


Two test suites are available, ```App.test``` and ```ContractFacade.test```.
App.test is responsible for UI testing, whereas ContractFacade.test focuses on the smart contract interactions.

## Running

```yarn start```

Will start a local webpack development server, and open a browser window with the game in local development.


Note: After signing up in game, an account is generated. To use the features, it needs to be funded. This is of course due to the PoC nature of the solution (productively, these costs should be offloaded).

## FAQ

### I don't see any targets under Attack menu

You need to regsiter a defence. Try registering one for yourself, the game currently allows attacking oneself also (for testing purposes obviously).

### Stuck on Waiting for blockchain...

Verify if the contracts have been deployed correctly, and the delegator contract address has been configured via ```yarn run genconfig```.

### Keep getting errors on every transaction

Ensure that the account that has been generated in app has been funded.

# Architecture

## Fight generation

An important concept with regard to fight generation is their determinism, as in the outcome of a fight, provided a set of input parameters, including the pseudorandom seed, will always be identical, down to every single move. This assumption allows for certain optimisations, which most importantly save a lot of gas, but also allows the recreation of fights to be done via RPCs, and limit the storage footprint to the fight input parameters only. This should vastly improve scaling, independently of the blockchain architecture.

## Events

Another gas saving measure, straight from Ethereum world, is relying heavily on events to store past interactions (currently, fights). Event iteration is done over RPC, so its free, and allows for greater flexibility.

## Accounts

The client manages account handling on its own, without relying on any browser extensions or other wallet implementtions. This makes it easier to deploy as a mobile hybrid app (at least under Android), and smoothens the onboarding experience. It is the authors opinion that convoluted security checks are not always the right approach for every usecase, and in gaming, smooth onboarding can mean the difference between success and failure.

## Assets

All graphical assets have been either a) purchased a commercial license for, or b) are shared under a permissive license. If any assets are present which do not follow these licensing rules, they have done so by omission. Please inform the Author immediately and they will be removed.

# The Game

Players register their fleet defences, and can be attacked, for leaderboard points, and commander experience points. The following menu items are available:

## Training

Allows training against a NPC opponent. When selecting fleet, by default it is the defenders fleet that is selected (mostly for PoC testing purposes).

## Academy

Allows viewing all commanders, together with their experience a player has accumulated.

## Defence

Registers a Defence, for others to attack.

## Attack

Perfroms a ranked Attack.

## Ranking

Shows the leaderboard (ranking of all registered fight participants).

# Payments (Microtransactions)

The client exposes buying loot crates, in very basic form; after transfering 1 unit of payment, a crate is generated, adding 10 xp to a random commander (most likely the lowest quality one).
