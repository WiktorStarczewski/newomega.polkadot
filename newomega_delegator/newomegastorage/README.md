# New Omega

* Tactical, space combat game, entirely on blockchain
* Made With Love for Polkadot

## Technical overview - Storage

Isolated storage for all things which should be considered player progress. This module should only ever change if a serious API change is needed, but otherwise it should survive most upgrades of the rest of the system, preserving the Game Board (state of the game) across upgrades and bugfixes. The only logic that belongs here is accessors for the storage.
