#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegagame::NewOmegaGame;

#[ink::contract]
mod newomegagame {
    use newomega::NewOmega;
    use newomega::Ship;
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
    pub struct NewOmegaGame {
        newomega: newomega::NewOmega,
        ships: Vec<Ship>,
    }

    impl NewOmegaGame {
        #[ink(constructor)]
        pub fn new(newomega: NewOmega) -> Self {
            Self {
                newomega,
                ships: Vec::new(),
            }
        }

        // TODO Make this restricted to owner
        #[ink(message)]
        pub fn addShip(&mut self, cp: u16, hp: u16, attack_base: u16, attack_variable: u16,
            defence: u16, speed: u8, range: u8) {

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
        pub fn getShips(&self) -> Vec<Ship> {
            self.ships.clone()
        }
    }
}
