#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegastorage::NewOmegaStorage;
pub use self::newomegastorage::CommanderData;
pub use self::newomegastorage::PlayerData;

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
        xp: u32,
    }

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
        ranked_wins: u32,
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

        #[ink(message)]
        pub fn clear_authorisations(&mut self) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            self.owners.clear();
            self.owners.push(self.env().caller());
        }

        #[ink(message)]
        pub fn authorise_contract(&mut self, contract: AccountId) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            self.owners.push(contract);
        }

        fn ensure_player(&mut self, caller: AccountId) -> &mut PlayerData {
            self.players
                .entry(caller)
                .or_insert(PlayerData::default())
        }

        #[ink(message)]
        pub fn mark_ranked_win(&mut self, caller: AccountId) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            let player_data = self.ensure_player(caller);
            player_data.ranked_wins = player_data.ranked_wins + 1;
        }

        #[ink(message)]
        pub fn mark_ranked_loss(&mut self, caller: AccountId) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            let player_data = self.ensure_player(caller);
            player_data.ranked_losses = player_data.ranked_losses + 1;
        }

        #[ink(message)]
        pub fn add_commander_xp(&mut self, caller: AccountId, commander_id: u8, amount: u32) {
            assert!(self.owners.iter().any(|owner| *owner == self.env().caller()));
            self.commanders
                .entry((caller, commander_id))
                .or_insert(CommanderData::default()).xp += amount;
        }

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

        #[ink(message)]
        pub fn has_commander(&self, caller: AccountId, commander_id: u8) -> bool {
            self.commanders.contains_key(&(caller, commander_id))
        }

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

            let leaderboard: Vec<PlayerData> = contract.get_leaderboard();

            assert_eq!(leaderboard.len(), 2);
            assert_eq!(leaderboard[0].ranked_wins, 1);
            assert_eq!(leaderboard[0].ranked_losses, 0);
            assert_eq!(leaderboard[1].ranked_wins, 0);
            assert_eq!(leaderboard[1].ranked_losses, 1);
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
