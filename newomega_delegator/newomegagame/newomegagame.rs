#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegagame::NewOmegaGame;

#[ink::contract]
mod newomegagame {
    use newomega::NewOmega;
    use newomega::Ship;
    use newomega::MAX_SHIPS;
    use newomega::FightResult;
    use newomega::Move;
    use ink_prelude::vec::Vec;

    #[ink(storage)]
    pub struct NewOmegaGame {
        owner: AccountId,
        new_omega: NewOmega,
        ships: Vec<Ship>,
    }

    impl NewOmegaGame {
        #[ink(constructor)]
        pub fn new(new_omega: NewOmega) -> Self {
            Self {
                owner: Self::env().caller(),
                new_omega,
                ships: newomega::prepare_ships(),
            }
        }

        #[ink(message)]
        pub fn add_ship(&mut self, cp: u16, hp: u16, attack_base: u16, attack_variable: u16,
            defence: u16, speed: u8, range: u8) {

            assert_eq!(self.env().caller(), self.owner);
            self.ships.push(Ship {
                cp,
                hp,
                attack_base,
                attack_variable,
                defence,
                speed,
                range,
            });
        }

        #[ink(message)]
        pub fn get_ships(&self) -> Vec<Ship> {
            self.ships.clone()
        }

        #[ink(message)]
        pub fn fight(&self, seed: u64, log_moves: bool, selection_lhs: [u8; MAX_SHIPS],
            selection_rhs: [u8; MAX_SHIPS], variants_lhs: [u8; MAX_SHIPS],
            variants_rhs: [u8; MAX_SHIPS], commander_lhs: u8, commander_rhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            self.new_omega.fight(seed, log_moves, self.get_ships(),
                selection_lhs, selection_rhs, variants_lhs, variants_rhs, commander_lhs, commander_rhs)
        }
    }
}
