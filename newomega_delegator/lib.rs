#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod newomegadelegator {
    use newomega::NewOmega;
    use newomega::FightResult;
    use newomega::Move;
    use newomega::Ship;
    use newomegagame::NewOmegaGame;
    use ink_prelude::vec::Vec;
    use ink_storage::{
        collections::{
            Vec as StorageVec,
        },
        traits::{
            PackedLayout,
            SpreadLayout,
        },
        Lazy,
    };

    #[ink(storage)]
    pub struct NewOmegaDelegator {
        new_omega: Lazy<NewOmega>,
        new_omega_game: Lazy<NewOmegaGame>,
    }

    impl NewOmegaDelegator {
        #[ink(constructor)]
        pub fn new(
            version: u32,
            newomega_code_hash: Hash,
            newomega_game_code_hash: Hash,
        ) -> Self {
            let total_balance = Self::env().balance();
            let salt = version.to_le_bytes();
            let new_omega = NewOmega::new()
                .endowment(total_balance / 4)
                .code_hash(newomega_code_hash)
                // .salt_bytes(salt)
                .instantiate()
                .expect("Failed instantiating NewOmega");
            let new_omega_game = NewOmegaGame::new(new_omega.clone())
                .endowment(total_balance / 4)
                .code_hash(newomega_game_code_hash)
                // .salt_bytes(salt)
                .instantiate()
                .expect("Failed instantiating NewOmegaGame");
            Self {
                new_omega: Lazy::new(new_omega),
                new_omega_game: Lazy::new(new_omega_game),
            }
        }

        #[ink(message)]
        pub fn replay(&self, seed: u64, selection_lhs: [u8; newomega::MAX_SHIPS],
            selection_rhs: [u8; newomega::MAX_SHIPS], variants_lhs: [u8; newomega::MAX_SHIPS],
            variants_rhs: [u8; newomega::MAX_SHIPS], commander_lhs: u8, commander_rhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            self.new_omega.fight(seed, true, self.new_omega_game.getShips(),
                selection_lhs, selection_rhs, variants_lhs, variants_rhs, commander_lhs, commander_rhs)
        }

        #[ink(message)]
        pub fn addShip(&mut self, cp: u16, hp: u16, attack_base: u16, attack_variable: u16,
            defence: u16, speed: u8, range: u8) {

            self.new_omega_game.addShip(cp, hp, attack_base, attack_variable, defence, speed, range);
        }
    }
}
