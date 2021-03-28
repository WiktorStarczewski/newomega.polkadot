#![feature(destructuring_assignment)]
#![feature(map_into_keys_values)]
#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegaranked::NewOmegaRanked;
pub use self::newomegaranked::PlayerDefence;

/// The logic for all ranked fights between players. Connected to Fight Management
/// in order to run fights, and to Storage in order to save the results and perform
/// actions according to their result.
#[ink::contract]
mod newomegaranked {
    use newomegagame::NewOmegaGame;
    use newomegastorage::NewOmegaStorage;
    use newomega::MAX_SHIPS;
    use newomega::FightResult;
    use ink_prelude::vec::Vec;
    use ink_prelude::string::String;
    use ink_storage::{
        collections::{
            HashMap as StorageHashMap,
        },
        traits::{
            PackedLayout,
            SpreadLayout,
        },
    };

    const XP_PER_RANKED_WIN: u32 = 1;

    /// Describes a registered defence of a player
    #[derive(scale::Encode, scale::Decode, SpreadLayout, PackedLayout, Clone)]
    #[cfg_attr(
        feature = "std",
        derive(
            Debug,
            PartialEq,
            Eq,
            scale_info::TypeInfo,
            ink_storage::traits::StorageLayout
        )
    )]
    pub struct PlayerDefence {
        /// Fleet composition
        selection: [u8; MAX_SHIPS],
        /// Fleet variants (fittings)
        variants: [u8; MAX_SHIPS],
        /// Commander index
        commander: u8,
        /// Defender name
        name: String,
    }

    #[ink(storage)]
    pub struct NewOmegaRanked {
        owner: AccountId,
        new_omega_game: newomegagame::NewOmegaGame,
        new_omega_storage: newomegastorage::NewOmegaStorage,
        defences: StorageHashMap<AccountId, PlayerDefence>,
    }

    impl NewOmegaRanked {
        #[ink(constructor)]
        pub fn new(new_omega_game: NewOmegaGame, new_omega_storage: NewOmegaStorage) -> Self {
            Self {
                owner: Self::env().caller(),
                new_omega_game,
                new_omega_storage,
                defences: StorageHashMap::default(),
            }
        }

        /// Registers a fleet for Ranked Defence.
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to register the defence for
        /// * `selection` - The fleet composition of the defence
        /// * `variants` - The variants (fittings) of the defence
        /// * `commander` - Index of the commander leading the defence
        /// * `name` - The defender name
        #[ink(message)]
        pub fn register_defence(&mut self, caller: AccountId, selection: [u8; MAX_SHIPS],
            variants: [u8; MAX_SHIPS], commander: u8, name: String) {

            assert_eq!(self.env().caller(), self.owner);
            self.defences.insert(caller, PlayerDefence {
                selection,
                variants,
                commander,
                name,
            });
        }

        /// Gets the registered defence of a player.
        /// Will panic if defence has not been registered for the player.
        ///
        /// # Arguments
        ///
        /// * `caller` - The account id of the player to register the defence for
        ///
        /// # Returns
        ///
        /// * `defence` - The registered defence
        #[ink(message)]
        pub fn get_own_defence(&self, caller: AccountId) -> PlayerDefence {
            assert_eq!(self.env().caller(), self.owner);
            assert!(self.defences.get(&caller).is_some());

            let defence: &PlayerDefence = self.defences.get(&caller).unwrap();

            PlayerDefence {
                selection: defence.selection,
                variants: defence.variants,
                commander: defence.commander,
                name: defence.name.clone(),
            }
        }

        /// Gets all the registered defenders (all players).
        ///
        /// # Returns
        ///
        /// * `defenders` - The registered defenders
        #[ink(message)]
        pub fn get_all_defenders(&self) -> Vec<(AccountId, PlayerDefence)> {
            self.defences
                .iter()
                .filter_map(|entry| {
                    let (&key, value) = entry;
                    Some((key, value.clone()))
                })
                .collect()
        }

        /// Calculates a ranked fight between two players.
        ///
        /// # Arguments
        ///
        /// * `caller` - account id of the attacker
        /// * `target` - account id of the defender
        /// * `selection` - Attacker fleet composition (array with ship quantities)
        /// * `variants` - An array that holds variants of the attacker fleet
        /// * `commander` - The attacker commander
        #[ink(message)]
        pub fn attack(&mut self, caller: AccountId, target: AccountId, selection: [u8; MAX_SHIPS],
            variants: [u8; MAX_SHIPS], commander: u8) -> FightResult {

            assert_eq!(self.env().caller(), self.owner);
            assert!(self.defences.get(&caller).is_some());
            assert!(self.defences.get(&target).is_some());

            // Try to get the defence
            let target_defence: &PlayerDefence = self.defences.get(&target).unwrap();
            // Determine the seed, in a naive way -> IMPROVEME: MOVE TO VRF
            let seed: u64 = self.env().block_timestamp();
            // Calculate the fight result
            let (result, _lhs_moves, _rhs_moves) =
                self.new_omega_game.fight(
                    seed,
                    false,
                    selection,
                    target_defence.selection,
                    variants,
                    target_defence.variants,
                    commander,
                    target_defence.commander);

            // Mark results of the fight on the leaderboard and adjust commander xp
            if result.lhs_dead {
                self.new_omega_storage.mark_ranked_win(target);
                self.new_omega_storage.mark_ranked_loss(caller);
                self.new_omega_storage.add_commander_xp(target,
                    target_defence.commander, XP_PER_RANKED_WIN);
            } else if result.rhs_dead {
                self.new_omega_storage.mark_ranked_win(caller);
                self.new_omega_storage.mark_ranked_loss(target);
                self.new_omega_storage.add_commander_xp(caller,
                    commander, XP_PER_RANKED_WIN);
            }

            result
        }
    }
}
