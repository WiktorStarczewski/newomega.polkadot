
# New Omega

* Tactical, space combat game, entirely on blockchain
* Made With Love for Polkadot

## Technical overview - Smart Contracts

The Solutions consists of 6 contracts in total:

* Delegator (newomegadelegator)
* Game Engine (newomega)
* Fight Management (newomegagame)
* Ranked Fight Management (newomegaranked)
* Rewarder (newomegarewarder)
* Storage (newomegastorage)

At the very bottom resides the Delegator pattern, represented by the Delegator module.
For more information about each contract, look at the README in their directories.


<img width="548" alt="newomega polkadot uml" src="https://user-images.githubusercontent.com/5662527/109423535-1791d300-79e0-11eb-9d02-f0577836270e.png">



* Delegator

The Delegator is the single point of interaction for the game client, and is responsible
for managing (instantiating, exchanging) the other contracts, as well as acting as a facade for their public methods. The only data the Delegator stores is the instances of the other contracts (in addition to the contract creator).

## Testing

### Off-chain
Off-chain (unit) tests are available, whenever possible (in contracts which dont manage other contracts).
Currently implemented in ```newomega```, covering the entire Game Engine, and in ```newomegastorage```, testing the Storage functions. To run, use standard ```cargo +nightly test``` from those two directories (not main directory).

### On-chain
On-chain testing assumes a Canvas instance (local node).
All steps are to be executed in the standard Canvas UI.

* Prerequisites
1. Build the solution using ```build.sh``` script provided.
2. Upload all the code bundles, note the hashes.
3. Deploy the Delegator (newomegadelegator.contract). Pass in all the other contract hashes into the constructor.

* Testing
In order to use the ```attack``` function, you need to first register the fleet for the defender and attacker (IMPORTANT).
The ```selection``` and ```variants``` are expected to be 4-element arrays of ```u8``` (it is reported in the Canvas UI). To pass them into the contracts, they need to be converted into byte arrays.
The ```selection``` can contain any ```u8```, the values ```variants``` are expected to be 0, 1, or 2 (panic otherwise). The practical meaning of variants is "fitting", 0 being normal, 1 defensive, and 2 offensive.

### Tip
[1,1,1,1] = 0x01010101
[2,2,2,2] = 0x02020202
... and so on

1. [as Alice] Execute the ```register_defence``` function with ```0x01010101``` as both ```selection``` and ```variants```. Pass ```0``` for commander, a recognisable string for name (eg. ```Alice```).

* Expected: Contract executes.

2. [as Bob] Execute the ```register_defence``` function with ```0x01010101``` as both ```selection``` and ```variants```. Pass ```0``` for commander, a recognisable string for name (eg. ```Bob```).

* Expected: Contract executes.

3. [as Alice] Execute the ```get_own_defence``` function.

* Expected: One entry, containing Alice's name, selection, variants and commander as passed in step #1.

4. [as Bob] Execute the ```get_own_defence``` function.

* Expected: One entry, containing Bob's name, selection, variants and commander as passed in step #2.

5. [as Alice] Execute the ```attack``` function, setting target to Bob, wth ```0x02020202``` as both ```selection``` and ```variants```. Pass ```0``` for commander.

### NOTE
It is best to use manual gas, and add a buffer to the estimate (suggested: 100000 (100k)). That is due to the random factor, which determines the amount of rounds, and therefore amount of computations.

* Expected: Contract executes.

6. [as whoever] Execute the ```get_leaderboard``` function.

* Expected: Two entries, one for Alice, one for Bob. The Alice entry contains 1 win, 0 losses. Bob has 0 wins and 1 loss.

7. [as Alice] Execute the ```get_commanders``` function.

* Expected: One entry, with a property ```xp``` set to ```1```.

8. [as Bob] Execute the ```get_commanders``` function.

* Expected: No entries.

## Testing the Rewarder module

Ensure there is enough funds (1 unit) in Eve's account.

1. [as Eve] Execute the ```buy_loot_crate``` function, with Payment set to 1 (unit).

* Expected: Contract executes.

2. [as Eve] Execute the ```get_commanders``` function.

* Expected: One entry, with the commander id (```u8```) same as returned from the call in step #1, and a property ```xp``` set to ```10```.

3. [as the account who deployed the Delegator ("X")] Execute the ```admin_withdraw_funds``` function. Pass in a small balance (not more than the contract has), like ```1```.

* Expected: The contract transfers the desired amount to the contract owner's account ("X").
