# New Omega

* Tactical, space combat game, entirely on blockchain
* Made With Love for Polkadot

## Game Engine contract

This contract has no storage, and all its methods are pure (stateless).
It is able to simulate fights, given a set of input parameters, for which it always gives a deterministic result. This implies, that the exact fight (moves of the players), can be always regenerated provided the same set of input parameters (fleet selection).
In fact, it is possible not to store (and return) the fight at all, only its result, via a boolean flag. This is used in order to save cost - precise fight generation can be recreated using (free) RPC calls, not paid transactions.
