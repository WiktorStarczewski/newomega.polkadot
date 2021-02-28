#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod newomegadelegator {
    use newomega::NewOmega;
    use newomega::FightResult;
    use newomega::Move;
    use newomega::MAX_SHIPS;
    use newomegagame::NewOmegaGame;
    use newomegaranked::NewOmegaRanked;
    use newomegaranked::PlayerDefence;
    use newomegastorage::NewOmegaStorage;
    use newomegastorage::CommanderData;
    use newomegastorage::PlayerData;
    use newomegarewarder::NewOmegaRewarder;
    use ink_prelude::vec::Vec;
    use ink_prelude::string::String;
    use ink_storage::{
        Lazy,
    };
    use ink_lang::ToAccountId;

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum RewardWithdrawError {
        TransferFailed,
        InsufficientFunds,
        BelowSubsistenceThreshold,
    }

    #[ink(storage)]
    pub struct NewOmegaDelegator {
        owner: AccountId,
        new_omega: Lazy<NewOmega>,
        new_omega_storage: Lazy<NewOmegaStorage>,
        new_omega_game: Lazy<NewOmegaGame>,
        new_omega_ranked: Lazy<NewOmegaRanked>,
        new_omega_rewarder: Lazy<NewOmegaRewarder>,
    }

    const LOOT_CRATE_PRICE: u128 = 1;

    impl NewOmegaDelegator {

        #[ink(constructor)]
        pub fn new(
            newomega_code_hash: Hash,
            newomega_storage_code_hash: Hash,
            newomega_game_code_hash: Hash,
            newomega_ranked_code_hash: Hash,
            newomega_rewarder_code_hash: Hash,
        ) -> Self {
            let total_balance = Self::env().balance();
            let new_omega = NewOmega::new()
                .endowment(total_balance / 8)
                .code_hash(newomega_code_hash)
                .instantiate()
                .expect("Failed instantiating NewOmega");
            let new_omega_game = NewOmegaGame::new(new_omega.clone())
                .endowment(total_balance / 8)
                .code_hash(newomega_game_code_hash)
                .instantiate()
                .expect("Failed instantiating NewOmegaGame");
            let mut new_omega_storage = NewOmegaStorage::new()
                .endowment(total_balance / 8)
                .code_hash(newomega_storage_code_hash)
                .instantiate()
                .expect("Failed instantiating NewOmegaStorage");
            let new_omega_ranked = NewOmegaRanked::new(new_omega_game.clone(), new_omega_storage.clone())
                .endowment(total_balance / 8)
                .code_hash(newomega_ranked_code_hash)
                .instantiate()
                .expect("Failed instantiating NewOmegaRanked");
            let new_omega_rewarder = NewOmegaRewarder::new(new_omega_storage.clone())
                .endowment(total_balance / 8)
                .code_hash(newomega_rewarder_code_hash)
                .instantiate()
                .expect("Failed instantiating NewOmegaRewarder");

            new_omega_storage.authorise_contract(new_omega_ranked.to_account_id());
            new_omega_storage.authorise_contract(new_omega_rewarder.to_account_id());

            Self {
                owner: Self::env().caller(),
                new_omega: Lazy::new(new_omega),
                new_omega_storage: Lazy::new(new_omega_storage),
                new_omega_game: Lazy::new(new_omega_game),
                new_omega_ranked: Lazy::new(new_omega_ranked),
                new_omega_rewarder: Lazy::new(new_omega_rewarder),
            }
        }

        #[ink(message)]
        pub fn replay(&self, seed: u64, selection_lhs: [u8; MAX_SHIPS],
            selection_rhs: [u8; MAX_SHIPS], variants_lhs: [u8; MAX_SHIPS],
            variants_rhs: [u8; MAX_SHIPS], commander_lhs: u8, commander_rhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            self.new_omega_game.fight(seed, true, selection_lhs, selection_rhs,
                variants_lhs, variants_rhs, commander_lhs, commander_rhs)
        }

        #[ink(message)]
        pub fn replay_result(&self, seed: u64, selection_lhs: [u8; MAX_SHIPS],
            selection_rhs: [u8; MAX_SHIPS], variants_lhs: [u8; MAX_SHIPS],
            variants_rhs: [u8; MAX_SHIPS], commander_lhs: u8, commander_rhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            self.new_omega_game.fight(seed, false, selection_lhs, selection_rhs,
                variants_lhs, variants_rhs, commander_lhs, commander_rhs)
        }

        #[ink(message)]
        pub fn add_ship(&mut self, cp: u16, hp: u16, attack_base: u16, attack_variable: u16,
            defence: u16, speed: u8, range: u8) {

            assert_eq!(self.env().caller(), self.owner);
            self.new_omega_game.add_ship(cp, hp, attack_base, attack_variable, defence, speed, range);
        }

        #[ink(message)]
        pub fn register_defence(&mut self, selection: [u8; MAX_SHIPS],
            variants: [u8; MAX_SHIPS], commander: u8, name: String) {

            let caller: AccountId = self.env().caller();
            self.new_omega_ranked.register_defence(caller, selection,
                variants, commander, name);
        }

        #[ink(message)]
        pub fn get_own_defence(&self) -> PlayerDefence {
            self.new_omega_ranked.get_own_defence(self.env().caller())
        }

        #[ink(message)]
        pub fn attack(&mut self, target: AccountId, selection: [u8; MAX_SHIPS],
            variants: [u8; MAX_SHIPS], commander: u8) {

            let caller: AccountId = self.env().caller();
            self.new_omega_ranked.attack(caller, target, selection, variants, commander);
        }

        #[ink(message)]
        pub fn get_leaderboard(&self) -> Vec<(AccountId, PlayerData)> {
            self.new_omega_storage.get_leaderboard()
        }

        #[ink(message)]
        pub fn get_commanders(&self) -> Vec<(u8, CommanderData)> {
            self.new_omega_storage.get_commanders(self.env().caller())
        }

        #[ink(message, payable)]
        pub fn buy_loot_crate(&mut self) -> u8 {
            assert!(self.env().transferred_balance() >= LOOT_CRATE_PRICE);
            let caller: AccountId = self.env().caller();
            self.new_omega_rewarder.buy_loot_crate(caller)
        }

        #[ink(message)]
        pub fn admin_withdraw_funds(&mut self, value: Balance) -> Result<(), RewardWithdrawError> {
            assert_eq!(self.env().caller(), self.owner);
            if value > self.env().balance() {
                return Err(RewardWithdrawError::InsufficientFunds)
            }
            self.env()
                .transfer(self.owner, value)
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
