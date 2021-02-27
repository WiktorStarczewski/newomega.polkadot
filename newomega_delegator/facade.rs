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
    use ink_prelude::vec::Vec;
    use ink_prelude::string::String;
    use ink_storage::{
        Lazy,
    };

    #[ink(storage)]
    pub struct NewOmegaDelegator {
        owner: AccountId,
        new_omega: Lazy<NewOmega>,
        new_omega_game: Lazy<NewOmegaGame>,
        new_omega_ranked: Lazy<NewOmegaRanked>,
    }

    impl NewOmegaDelegator {
        #[ink(constructor)]
        pub fn new(
            // version: u32,
            newomega_code_hash: Hash,
            newomega_game_code_hash: Hash,
            newomega_ranked_code_hash: Hash,
        ) -> Self {
            let total_balance = Self::env().balance();
            // let salt = version.to_le_bytes();
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
            let new_omega_ranked = NewOmegaRanked::new(new_omega_game.clone())
                .endowment(total_balance / 4)
                .code_hash(newomega_ranked_code_hash)
                // .salt_bytes(salt)
                .instantiate()
                .expect("Failed instantiating NewOmegaRanked");
            Self {
                owner: Self::env().caller(),
                new_omega: Lazy::new(new_omega),
                new_omega_game: Lazy::new(new_omega_game),
                new_omega_ranked: Lazy::new(new_omega_ranked),
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
        pub fn get_leaderboard(&self) -> Vec<PlayerDefence> {
            self.new_omega_ranked.get_leaderboard()
        }

        #[ink(message)]
        pub fn mark_win(&mut self, target: AccountId) {
            assert_eq!(self.env().caller(), self.owner);
            self.new_omega_ranked.mark_win(target);
        }

        #[ink(message)]
        pub fn mark_loss(&mut self, target: AccountId) {
            assert_eq!(self.env().caller(), self.owner);
            self.new_omega_ranked.mark_loss(target);
        }
    }
}
