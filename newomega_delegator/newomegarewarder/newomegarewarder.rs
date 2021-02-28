#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomegarewarder::NewOmegaRewarder;
pub use self::newomegarewarder::RewardWithdrawError;

#[ink::contract]
mod newomegarewarder {
    use newomegastorage::NewOmegaStorage;
    use ink_prelude::vec::Vec;

    const LOOT_CRATE_PRICE: u128 = 1;
    const XP_PER_LOOT_CRATE: u32 = 10;
    const MAX_COMMANDERS: u8 = 4;

    #[ink(storage)]
    pub struct NewOmegaRewarder {
        owner: AccountId,
        new_omega_storage: NewOmegaStorage,
    }

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum RewardWithdrawError {
        TransferFailed,
        InsufficientFunds,
        BelowSubsistenceThreshold,
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

        #[ink(message, payable)]
        pub fn buy_loot_crate(&mut self, caller: AccountId) -> u8 {
            assert_eq!(self.env().caller(), self.owner);
            assert!(self.env().transferred_balance() == LOOT_CRATE_PRICE);

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

        /*
        ** https://github.com/paritytech/ink/blob/master/examples/contract-transfer/lib.rs
        */
        #[ink(message)]
        pub fn withdraw_funds(&mut self, caller: AccountId, value: Balance) -> Result<(), RewardWithdrawError> {
            assert_eq!(self.env().caller(), self.owner);
            if value > self.env().balance() {
                return Err(RewardWithdrawError::InsufficientFunds)
            }
            self.env()
                .transfer(caller, value)
                .map_err(|err| {
                    match err {
                        ink_env::Error::BelowSubsistenceThreshold => {
                            RewardWithdrawError::BelowSubsistenceThreshold
                        }
                        _ => RewardWithdrawError::TransferFailed,
                    }
                })
        }
    }
}
