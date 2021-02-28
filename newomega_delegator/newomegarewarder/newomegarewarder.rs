#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegarewarder::NewOmegaRewarder;

#[ink::contract]
mod newomegarewarder {
    use newomegastorage::NewOmegaStorage;
    use ink_prelude::vec::Vec;

    const XP_PER_LOOT_CRATE: u32 = 10;
    const MAX_COMMANDERS: u8 = 4;

    #[ink(storage)]
    pub struct NewOmegaRewarder {
        owner: AccountId,
        new_omega_storage: NewOmegaStorage,
    }

    impl NewOmegaRewarder {
        #[ink(constructor)]
        pub fn new(new_omega_storage: NewOmegaStorage) -> Self {
            Self {
                owner: Self::env().caller(),
                new_omega_storage,
            }
        }

        // IMPROVEME Move to VRF when available :)
        fn dice_roll(&self, sides: u8) -> u8 {
            let seed: u64 = self.env().block_timestamp();
            (seed % sides as u64) as u8
        }

        #[ink(message)]
        pub fn buy_loot_crate(&mut self, caller: AccountId) -> u8 {
            assert_eq!(self.env().caller(), self.owner);

            let mut picked_commander: u8 = 0;
            let max_roll: u8 = 100;
            let roll: u8 = self.dice_roll(max_roll);
            let mut prob: u8 = 75;

            for i in 0..MAX_COMMANDERS {
                if roll < prob {
                    picked_commander = i as u8;
                    break;
                }

                prob += (max_roll - prob) / 2;
            }

            self.new_omega_storage.add_commander_xp(caller, picked_commander, XP_PER_LOOT_CRATE);

            picked_commander
        }
    }
}
