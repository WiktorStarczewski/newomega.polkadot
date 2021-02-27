#![feature(destructuring_assignment)]
#![feature(map_into_keys_values)]
#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegaranked::NewOmegaRanked;
pub use self::newomegaranked::PlayerDefence;

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

    pub const XP_PER_RANKED_WIN: u32 = 1;

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
        selection: [u8; MAX_SHIPS],
        variants: [u8; MAX_SHIPS],
        commander: u8,
        name: String,
    }


    // gamerewarder
    // OPTIONAL commanders, increase xp, expose get_my_commanders
    // OPTIONAL make newomegastorage

    #[ink(storage)]
    pub struct NewOmegaRanked {
        owner: AccountId,
        new_omega_game: newomegagame::NewOmegaGame,
        new_omega_storage: newomegastorage::NewOmegaStorage,
        defences: StorageHashMap<AccountId, PlayerDefence>,
    }

    #[ink(event)]
    pub struct RankedFightComplete {
        #[ink(topic)]
        attacker: AccountId,
        #[ink(topic)]
        defender: AccountId,
        result: FightResult,
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

        #[ink(message)]
        pub fn attack(&mut self, caller: AccountId, target: AccountId, selection: [u8; MAX_SHIPS],
            variants: [u8; MAX_SHIPS], commander: u8) {

            assert_eq!(self.env().caller(), self.owner);
            assert!(self.defences.get(&caller).is_some());
            assert!(self.defences.get(&target).is_some());

            let target_defence: &PlayerDefence = self.defences.get(&target).unwrap();
            let seed: u64 = self.env().block_timestamp();
            let (result, lhs_moves, rhs_moves) =
                self.new_omega_game.fight(
                    seed,
                    false,
                    selection,
                    target_defence.selection,
                    variants,
                    target_defence.variants,
                    commander,
                    target_defence.commander);

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

            self.env().emit_event(RankedFightComplete {
                attacker: caller,
                defender: target,
                result,
            });
        }
    }
}
