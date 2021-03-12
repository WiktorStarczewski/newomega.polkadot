#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegastorage::NewOmegaStorage;
pub use self::newomegastorage::CommanderData;
pub use self::newomegastorage::PlayerData;

/// Isolated storage for all things which should be considered player progress.
/// This module should only ever change if a serious API change is needed, but otherwise
/// it should survive most upgrades of the rest of the system, preserving the Game Board
/// (state of the game) across upgrades and bugfixes.
/// The only logic that belongs here is accessors for the storage.
#[ink::contract]
mod newomegastorage {
    use ink_prelude::vec::Vec;
    use ink_storage::{
        collections::{
            Vec as StorageVec,
            HashMap as StorageHashMap,
        },
        traits::{
            PackedLayout,
            SpreadLayout
        },
    };

    /// Holds the current progress of a commander
    #[derive(scale::Encode, scale::Decode, SpreadLayout, PackedLayout, Clone, Default,
        Copy, Debug, Eq, PartialEq)]
    #[cfg_attr(
        feature = "std",
        derive(
            scale_info::TypeInfo,
            ink_storage::traits::StorageLayout
        )
    )]
    pub struct CommanderData {
        /// Experience points
        xp: u32,
    }

    /// Holds the current leaderboard standing of a player
    #[derive(scale::Encode, scale::Decode, SpreadLayout, PackedLayout, Clone, Default,
        Copy, Debug, Eq, PartialEq)]
    #[cfg_attr(
        feature = "std",
        derive(
            scale_info::TypeInfo,
            ink_storage::traits::StorageLayout
        )
    )]
    pub struct PlayerData {
        /// Number of wins
        ranked_wins: u32,
        /// Number of losses
        ranked_losses: u32,
    }

    #[ink(storage)]
    pub struct NewOmegaStorage {
        owners: StorageVec<AccountId>,
        players: StorageHashMap<AccountId, PlayerData>,
        commanders: StorageHashMap<(AccountId, u8), CommanderData>,
    }

    impl NewOmegaStorage {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut owners = StorageVec::default();
            owners.push(Self::env().caller());

            Self {
                owners,
                players: StorageHashMap::default(),
                commanders: StorageHashMap::default(),
            }
        }

        #[ink(constructor)]
        pub fn default() -> Self {
            Self::new()
        }

        /// Clears all the contract authorisations.
        #[ink(message)]
        pub fn clear_authorisations(&mut self) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            self.owners.clear();
            self.owners.push(self.env().caller());
        }

        /// Authorises a contract to allow it to use this contract.
        /// Only authorised contracts can manipulate the storage.
        ///
        /// # Arguments
        ///
        /// * `contract` - The contract address to be authorised
        #[ink(message)]
        pub fn authorise_contract(&mut self, contract: AccountId) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            self.owners.push(contract);
        }

        /// Ensures that a player data structure is defined.
        /// Inserts the default if it is not.
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to ensure data for
        fn ensure_player(&mut self, caller: AccountId) -> &mut PlayerData {
            self.players
                .entry(caller)
                .or_insert(PlayerData::default())
        }

        /// Marks a ranked win for a player
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to mark
        #[ink(message)]
        pub fn mark_ranked_win(&mut self, caller: AccountId) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            let player_data = self.ensure_player(caller);
            player_data.ranked_wins = player_data.ranked_wins + 1;
        }

        /// Marks a ranked loss for a player
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to mark
        #[ink(message)]
        pub fn mark_ranked_loss(&mut self, caller: AccountId) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            let player_data = self.ensure_player(caller);
            player_data.ranked_losses = player_data.ranked_losses + 1;
        }

        /// Adds Experience Points to a player's commander
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to mark
        /// * `commander_id` - The id of commander to increase XP for
        /// * `amount` - The amount of XP to increase
        #[ink(message)]
        pub fn add_commander_xp(&mut self, caller: AccountId, commander_id: u8, amount: u32) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            self.commanders
                .entry((caller, commander_id))
                .or_insert(CommanderData::default()).xp += amount;
        }

        /// Gets all the owned commanders for a player.
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to get commanders for
        ///
        /// # Returns
        ///
        /// * `commanders` - A Vec containing a tuple of (commander id, commander data)
        #[ink(message)]
        pub fn get_commanders(&self, caller: AccountId) -> Vec<(u8, CommanderData)> {
            self.commanders
                .iter()
                .filter_map(|entry| {
                    let (&key, &value) = entry;
                    let (account, commander_id) = key;
                    if account == caller {
                        Some((commander_id, value))
                    } else {
                        None
                    }
                })
                .collect()
        }

        /// Checks whether a player owns a commander.
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to get commanders for
        /// * `commander_id` - The id of the commander to check for
        ///
        /// # Returns
        ///
        /// * `has_commander` - Whether player owns the commander
        #[ink(message)]
        pub fn has_commander(&self, caller: AccountId, commander_id: u8) -> bool {
            self.commanders.contains_key(&(caller, commander_id))
        }

        /// Gets the current ranked leaderboard.
        ///
        /// # Returns
        ///
        /// * `leaderboard` - A Vec containing a tuple of (player account id, player data)
        #[ink(message)]
        pub fn get_leaderboard(&self) -> Vec<(AccountId, PlayerData)> {
            self.players
                .iter()
                .filter_map(|entry| {
                    let (&key, &value) = entry;
                    Some((key, value))
                })
                .collect()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink_env::{
            test,
        };
        use ink_lang as ink;
        type Accounts = test::DefaultAccounts<Environment>;

        fn default_accounts() -> Accounts {
            test::default_accounts()
                .expect("Test environment is expected to be initialized.")
        }

        #[ink::test]
        fn test_ranked_marking() {
            let mut contract = NewOmegaStorage::default();
            let accounts = default_accounts();

            contract.mark_ranked_win(accounts.alice);
            contract.mark_ranked_loss(accounts.bob);

            let leaderboard: Vec<(AccountId, PlayerData)> = contract.get_leaderboard();

            assert_eq!(leaderboard.len(), 2);
            assert_eq!(leaderboard[0].1.ranked_wins, 1);
            assert_eq!(leaderboard[0].1.ranked_losses, 0);
            assert_eq!(leaderboard[1].1.ranked_wins, 0);
            assert_eq!(leaderboard[1].1.ranked_losses, 1);
        }

        #[ink::test]
        fn test_commanders() {
            let mut contract = NewOmegaStorage::default();
            let accounts = default_accounts();

            contract.add_commander_xp(accounts.alice, 0, 100);
            contract.add_commander_xp(accounts.bob, 1, 50);

            let commanders_alice: Vec<(u8, CommanderData)> = contract.get_commanders(accounts.alice);
            let commanders_bob: Vec<(u8, CommanderData)> = contract.get_commanders(accounts.bob);
            let commanders_eve: Vec<(u8, CommanderData)> = contract.get_commanders(accounts.eve);

            assert_eq!(commanders_alice.len(), 1);
            assert_eq!(commanders_bob.len(), 1);
            assert_eq!(commanders_eve.len(), 0);

            let (commander_index_alice, commander_data_alice) = commanders_alice[0];
            assert_eq!(commander_index_alice, 0);
            assert_eq!(commander_data_alice.xp, 100);

            let (commander_index_bob, commander_data_bob) = commanders_bob[0];
            assert_eq!(commander_index_bob, 1);
            assert_eq!(commander_data_bob.xp, 50);
        }
    }
}
