#![feature(destructuring_assignment)]
#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomega::NewOmega;
pub use self::newomega::Ship;
pub use self::newomega::Move;
pub use self::newomega::FightResult;
pub use self::newomega::MAX_SHIPS;

#[ink::contract]
mod newomega {
    #[ink(storage)]
    pub struct NewOmega {}

    pub const BOARD_SIZE: i8 = 15;
    pub const MAX_ROUNDS: usize = 50;
    pub const MAX_SHIPS: usize = 4;
    pub const FIT_TO_STAT: u16 = 20;

    use ink_prelude::vec::Vec;
    use ink_storage::{
        collections::{
            HashMap as StorageHashMap,
            Stash as StorageStash,
            Vec as StorageVec,
        },
        traits::{
            PackedLayout,
            SpreadLayout,
        },
        Lazy,
    };
    use scale::Output;

    #[derive(scale::Encode, scale::Decode, SpreadLayout, PackedLayout, Copy, Clone)]
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
    pub struct Move {
        move_type: u8,
        round: u8,
        source: u8,
        target: u8,
        target_position: i8,
        damage: u32
    }

    #[derive(scale::Encode, scale::Decode, SpreadLayout, PackedLayout, Copy, Clone)]
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
    pub struct Ship {
        pub cp: u16,
        pub hp: u16,
        pub attack_base: u16,
        pub attack_variable: u16,
        pub defence: u16,
        pub speed: u8,
        pub range: u8
    }

    #[derive(scale::Encode, scale::Decode, SpreadLayout, PackedLayout)]
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
    pub struct FightResult {
        selection_lhs: [u8; MAX_SHIPS],
        selection_rhs: [u8; MAX_SHIPS],
        variants_lhs: [u8; MAX_SHIPS],
        variants_rhs: [u8; MAX_SHIPS],
        commander_lhs: u8,
        commander_rhs: u8,
        lhs_dead: bool,
        rhs_dead: bool,
        rounds: u8,
        seed: u64,
        ships_lost_lhs: [u8; MAX_SHIPS],
        ships_lost_rhs: [u8; MAX_SHIPS]
    }

    impl NewOmega {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self { }
        }

        #[ink(constructor)]
        pub fn default() -> Self {
            Self::new()
        }

        fn min(&self, lhs: i32, rhs: i32) -> i32 {
            let result: i32;
            if lhs > rhs {
                result = rhs;
            } else {
                result = lhs;
            }
            result
        }

        fn max(&self, lhs: i32, rhs: i32) -> i32 {
            let result: i32;
            if lhs > rhs {
                result = lhs;
            } else {
                result = rhs;
            }
            result
        }

        fn isDead(&self, shipHps: [i32; MAX_SHIPS]) -> bool {
            let mut isTargetDead: bool = true;

            for i in 0..MAX_SHIPS {
                if shipHps[i] > 0 {
                    isTargetDead = false;
                }
            }

            isTargetDead
        }

        fn getDefenceStat(&self, stat: u16, variant: u8) -> u16 {
            let mut finalStat: u16 = 0;

            match variant {
                0 => finalStat = stat,
                1 => finalStat = stat + FIT_TO_STAT,
                2 => finalStat = stat - FIT_TO_STAT,
                _ => (),
            }

            finalStat
        }

        fn getAttackStat(&self, stat: u16, variant: u8) -> u16 {
            let mut finalStat: u16 = 0;

            match variant {
                0 => finalStat = stat,
                1 => finalStat = stat - FIT_TO_STAT,
                2 => finalStat = stat + FIT_TO_STAT,
                _ => (),
            }

            finalStat
        }

        fn getTarget(&self, Ships: &Vec<Ship>, current_ship: u8,
            ship_positions_own: [i8; MAX_SHIPS], ship_positions_enemy: [i8; MAX_SHIPS],
            ship_hps_enemy: [i32; MAX_SHIPS]) -> (bool, u8, u8) {

            let current_shipUsize:usize = current_ship as usize;
            let position:i8 = ship_positions_own[current_shipUsize];
            let mut proposed_move:u8 = 0;
            let mut min_distance_index:u8 = MAX_SHIPS as u8;

            for enemy_ship in (0..MAX_SHIPS as u8).rev() {
                let enemy_shipUsize:usize = enemy_ship as usize;
                let delta:u8 = (position - ship_positions_enemy[enemy_shipUsize]).abs() as u8;

                if (delta <= Ships[current_shipUsize].range + Ships[current_shipUsize].speed) &&
                    ship_hps_enemy[current_shipUsize] > 0 {

                    min_distance_index = enemy_ship;
                    if delta > Ships[current_shipUsize].range {
                        proposed_move = delta - Ships[current_shipUsize].range;
                    } else {
                        proposed_move = 0;
                    }

                    break;
                }
            }

            (min_distance_index < (MAX_SHIPS as u8), min_distance_index, proposed_move)
        }

        fn calculateDamage(&self, variables: [u16; MAX_SHIPS], variants_source: [u8; MAX_SHIPS],
            variants_target: [u8; MAX_SHIPS], Ships: &Vec<Ship>, source: u8,
            target: u8, source_hp: u32) -> u32 {

            let sourceUsize: usize = source as usize;
            let targetUsize: usize = target as usize;
            let attack: u16 = self.getAttackStat(Ships[sourceUsize].attack_base,
                variants_source[sourceUsize]) + variables[sourceUsize];
            let source_ships_count: u16 = (source_hp / Ships[sourceUsize].hp as u32) as u16 + 1;
            let cap_damage: u32 = (source_ships_count as u32) * (Ships[targetUsize].hp as u32);
            let mut damage: u32 = (attack - self.getDefenceStat(Ships[targetUsize].defence, variants_target[targetUsize])) as u32 *
                (source_ships_count as u32);

            if ((source as i8) - (target as i8) == 1) ||
                (source == 0 && target == MAX_SHIPS as u8 - 1) {

                damage *= damage / 2;
            }

            return self.min(self.max(0, damage as i32), cap_damage as i32) as u32;
        }

        fn logShoot(&self, moveNumber: &mut u16, round: u8, moves: &mut Vec<Move>,
            source: u8, target: u8, damage: u32, position: i8) {

            moves.push(Move {
                move_type: 1,
                round: round,
                source: source,
                target: target,
                damage: damage,
                target_position: position
            });
        }

        fn logMove(&self, moveNumber: &mut u16, round: u8, moves: &mut Vec<Move>,
            source: u8, target_position: i8) {

            moves.push(Move {
                move_type: 2,
                round: round,
                source: source,
                target_position: target_position,
                target: 0,
                damage: 0
            });
        }

        #[ink(message)]
        pub fn fight(&self, seed: u64, log_moves: bool, Ships: Vec<Ship>,
            selection_lhs: [u8; MAX_SHIPS], selection_rhs: [u8; MAX_SHIPS],
            variants_lhs: [u8; MAX_SHIPS], variants_rhs: [u8; MAX_SHIPS],
            commander_lhs: u8, commander_rhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            let mut ship_positions_lhs: [i8; MAX_SHIPS] = [10, 11, 12, 13];
            let mut ship_positions_rhs: [i8; MAX_SHIPS] = [-10, -11, -12, -13];
            let mut ship_hps_lhs: [i32; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut ship_hps_rhs: [i32; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut variables_lhs: [u16; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut variables_rhs: [u16; MAX_SHIPS] = [0; MAX_SHIPS];

            for i in 0..MAX_SHIPS {
                ship_hps_lhs[i] = (Ships[i].hp as i32) * (selection_lhs[i] as i32);
                ship_hps_rhs[i] = (Ships[i].hp as i32) * (selection_rhs[i] as i32);
                variables_lhs[i] = (seed % Ships[i].attack_variable as u64) as u16;
                variables_rhs[i] = ((seed / 2) % Ships[i].attack_variable as u64) as u16;
            }

            let mut lhs_moves: Option<Vec<Move>> = None;
            let mut rhs_moves: Option<Vec<Move>> = None;
            let mut total_rounds: u8 = 0;

            let empty_move: Move = Move {
                move_type: 0,
                round: 0,
                damage: 0,
                source: 0,
                target: 0,
                target_position: 0,
            };

            if log_moves {
                lhs_moves = Some(Vec::new());
                rhs_moves = Some(Vec::new());
            }

            for round in 0..MAX_ROUNDS {
                if self.isDead(ship_hps_lhs) || self.isDead(ship_hps_rhs) {
                    break;
                }

                let roundU8: u8 = round as u8;
                total_rounds = total_rounds + 1;

                for current_ship in 0..MAX_SHIPS {
                    let current_shipU8: u8 = current_ship as u8;
                    let mut lhs_has_target: bool = false;
                    let mut rhs_has_target: bool = false;
                    let lhs_dead_ship: bool = ship_hps_lhs[current_ship] <= 0;
                    let rhs_dead_ship: bool = ship_hps_rhs[current_ship] <= 0;
                    let mut lhs_damage: u32 = 0;
                    let mut rhs_damage: u32 = 0;
                    let mut lhs_target: u8 = 0;
                    let mut rhs_target: u8 = 0;
                    let mut lhs_delta_move: u8 = 0;
                    let mut rhs_delta_move: u8 = 0;
                    let mut lhs_move_number: u16 = 0;
                    let mut rhs_move_number: u16 = 0;

                    if !lhs_dead_ship {
                        (lhs_has_target, lhs_target, lhs_delta_move) = self.getTarget(
                            &Ships, current_shipU8, ship_positions_lhs, ship_positions_rhs, ship_hps_rhs);

                        if lhs_has_target {
                            lhs_damage = self.calculateDamage(variables_lhs, variants_lhs, variants_rhs,
                                &Ships, current_shipU8, lhs_target, ship_hps_lhs[current_ship] as u32);

                            match lhs_moves {
                                Some(ref mut moves) =>
                                    self.logShoot(&mut lhs_move_number, roundU8, moves, current_shipU8, lhs_target, lhs_damage,
                                        ship_positions_lhs[current_ship] - (lhs_delta_move as i8)),
                                None => {}
                            }
                        } else {
                            match lhs_moves {
                                Some(ref mut moves) =>
                                    self.logMove(&mut lhs_move_number, roundU8, moves, current_shipU8, ship_positions_lhs[current_ship] -
                                        (Ships[current_ship].speed as i8)),
                                None => {}
                            }
                        }
                    }

                    if !rhs_dead_ship {
                        (rhs_has_target, rhs_target, rhs_delta_move) = self.getTarget(
                            &Ships, current_shipU8, ship_positions_rhs, ship_positions_lhs, ship_hps_lhs);

                        if rhs_has_target {
                            rhs_damage = self.calculateDamage(variables_rhs, variants_rhs, variants_lhs,
                                &Ships, current_shipU8, rhs_target, ship_hps_rhs[current_ship] as u32);
                            ship_hps_lhs[rhs_target as usize] -= rhs_damage as i32;
                            ship_positions_rhs[current_ship] += rhs_delta_move as i8;

                            match rhs_moves {
                                Some(ref mut moves) =>
                                    self.logShoot(&mut rhs_move_number, roundU8, moves, current_shipU8, rhs_target, rhs_damage,
                                        ship_positions_rhs[current_ship]),
                                None => {}
                            }
                        } else {
                            ship_positions_rhs[current_ship] += Ships[current_ship].speed as i8;

                            match rhs_moves {
                                Some(ref mut moves) =>
                                    self.logMove(&mut rhs_move_number, roundU8, moves, current_shipU8,
                                        ship_positions_rhs[current_ship]),
                                None => {}
                            }
                        }
                    }

                    if !lhs_dead_ship {
                        if lhs_has_target {
                            ship_hps_rhs[lhs_target as usize] -= lhs_damage as i32;
                            ship_positions_lhs[current_ship] -= lhs_delta_move as i8;
                        } else {
                            ship_positions_lhs[current_ship] -= Ships[current_ship].speed as i8;
                        }
                    }
                }
            }

            let mut ships_lost_lhs: [u8; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut ships_lost_rhs: [u8; MAX_SHIPS] = [0; MAX_SHIPS];
            for i in 0..MAX_SHIPS {
                let safe_hp_lhs: u32 = self.max(ship_hps_lhs[i], 0) as u32;
                let safe_hp_rhs: u32 = self.max(ship_hps_rhs[i], 0) as u32;
                ships_lost_lhs[i] = (((selection_lhs[i] as u32 * Ships[i].hp as u32) - safe_hp_lhs) / Ships[i].hp as u32) as u8;
                ships_lost_rhs[i] = (((selection_rhs[i] as u32 * Ships[i].hp as u32) - safe_hp_rhs) / Ships[i].hp as u32) as u8;
            }

            let mut total_rhs_ships: u16 = 0;
            for i in 0..MAX_SHIPS {
                total_rhs_ships += selection_rhs[i] as u16;
            }

            let result: FightResult = FightResult {
                selection_lhs: selection_lhs,
                selection_rhs: selection_rhs,
                variants_lhs: variants_lhs,
                variants_rhs: variants_rhs,
                commander_lhs: commander_lhs,
                commander_rhs: commander_rhs,
                lhs_dead: total_rhs_ships > 0 && self.isDead(ship_hps_lhs),
                rhs_dead: self.isDead(ship_hps_rhs),
                ships_lost_lhs: ships_lost_lhs,
                ships_lost_rhs: ships_lost_rhs,
                rounds: total_rounds,
                seed: seed
            };

            (result, lhs_moves, rhs_moves)
        }
    }


    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn default_works() {
            let contract = NewOmega::default();
            assert_eq!(contract.get(), 0);
        }

        #[test]
        fn it_works() {
            let mut contract = NewOmega::new();
        }
    }
}
