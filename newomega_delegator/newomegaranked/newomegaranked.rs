#![feature(destructuring_assignment)]
#![feature(map_into_keys_values)]
#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegaranked::NewOmegaRanked;
pub use self::newomegaranked::PlayerDefence;

#[ink::contract]
mod newomegaranked {
    use newomegagame::NewOmegaGame;
    use newomega::MAX_SHIPS;
    use newomega::FightResult;
    use ink_env::random;
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
        wins: u32,
        losses: u32,
    }

    #[ink(storage)]
    pub struct NewOmegaRanked {
        owner: AccountId,
        new_omega_game: newomegagame::NewOmegaGame,
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
        pub fn new(new_omega_game: NewOmegaGame) -> Self {
            Self {
                owner: Self::env().caller(),
                new_omega_game,
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
                wins: 0,
                losses: 0,
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
                wins: defence.wins,
                losses: defence.losses,
            }
        }

        fn hash(t: &Hash) -> u64 {
           // let mut s = DefaultHasher::new();
           // t.hash(&mut s);
           // s.finish()
           1234567
        }

        #[ink(message)]
        pub fn mark_win(&mut self, caller: AccountId) {
            assert_eq!(self.env().caller(), self.owner);
            assert!(self.defences.get(&caller).is_some());
            let player_defence: &mut PlayerDefence = self.defences.get_mut(&caller).unwrap();
            player_defence.wins = player_defence.wins + 1;
        }

        #[ink(message)]
        pub fn mark_loss(&mut self, caller: AccountId) {
            assert_eq!(self.env().caller(), self.owner);
            assert!(self.defences.get(&caller).is_some());
            let player_defence: &mut PlayerDefence = self.defences.get_mut(&caller).unwrap();
            player_defence.losses = player_defence.losses + 1;
        }

        #[ink(message)]
        pub fn attack(&mut self, caller: AccountId, target: AccountId, selection: [u8; MAX_SHIPS],
            variants: [u8; MAX_SHIPS], commander: u8) {

            // assert_eq!(self.env().caller(), self.owner);
            assert!(self.defences.get(&caller).is_some());
            assert!(self.defences.get(&target).is_some());

            let target_defence: &PlayerDefence = self.defences.get(&target).unwrap();
            let seed: u64 = 1234567; //NewOmegaRanked::hash(random(&selection).unwrap());
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
                self.mark_win(target);
                self.mark_loss(caller);
            } else if result.rhs_dead {
                self.mark_win(caller);
                self.mark_loss(target);
            }

            self.env().emit_event(RankedFightComplete {
                attacker: caller,
                defender: target,
                result,
            });
        }

        #[ink(message)]
        pub fn get_leaderboard(&self) -> Vec<PlayerDefence> {

            assert_eq!(self.env().caller(), self.owner);
            self.defences
                .values()
                .cloned()
                .collect()
        }
    }
}
