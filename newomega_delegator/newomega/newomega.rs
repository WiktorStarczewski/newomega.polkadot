#![feature(destructuring_assignment)]
#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;
pub use self::newomega::NewOmega;
pub use self::newomega::Ship;
pub use self::newomega::Move;
pub use self::newomega::FightResult;
pub use self::newomega::MAX_SHIPS;
pub use self::newomega::prepare_ships;

/// This contract has no storage, and all its methods are pure (stateless).
/// It is able to simulate fights, given a set of input parameters,
/// for which it always gives a deterministic result.
/// This implies, that the exact fight (moves of the players), can be always
/// regenerated provided the same set of input parameters (fleet selection).
/// In fact, it is possible not to store (and return) the fight at all,
/// only its result, via a boolean flag.
/// This is used in order to save cost - precise fight generation can be recreated using (free)
/// RPC calls, not paid transactions.
#[ink::contract]
mod newomega {
    #[ink(storage)]
    pub struct NewOmega {}

    pub const MAX_SHIPS: usize = 4;
    const MAX_ROUNDS: usize = 50;
    const FIT_TO_STAT: u16 = 20;

    use ink_prelude::vec::Vec;
    use ink_storage::{
        traits::{
            PackedLayout,
            SpreadLayout,
        },
    };

    /// Describes a single move in a fight.
    /// A move can be pure reposition, shoot, or reposition with shoot.
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
        /// Shoot, Reposition
        move_type: u8,
        /// Round the move took place in
        round: u8,
        /// Source ship id
        source: u8,
        /// Target ship id, in the case of shoot
        target: u8,
        /// Position to move to, if needed
        target_position: i8,
        /// Damage of the shot, if needed
        damage: u32
    }

    /// Describes a single Ship on the board
    /// A move can be pure reposition, shoot, or reposition with shoot.
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
        /// Command Power (to calculate fleet weights)
        pub cp: u16,
        /// Health Points of the ship
        pub hp: u16,
        /// Base attack
        pub attack_base: u16,
        /// Variable attack (subject to random)
        pub attack_variable: u16,
        /// Defence of the ship
        pub defence: u16,
        /// Speed, number of fields the ship can move in a round
        pub speed: u8,
        /// Range, number of fields in front of it the ship can shoot to in a round
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
        /// Attacker fleet composition
        selection_lhs: [u8; MAX_SHIPS],
        /// Defencer fleet composition
        selection_rhs: [u8; MAX_SHIPS],
        /// Attacker ship variants (fittings, 0=neutral, 1=defensive, 2=offensive)
        variants_lhs: [u8; MAX_SHIPS],
        /// Defender ship variants (fittings, 0=neutral, 1=defensive, 2=offensive)
        variants_rhs: [u8; MAX_SHIPS],
        /// Attacker commander id
        commander_lhs: u8,
        /// Defender commander id
        commander_rhs: u8,
        /// Did the attacker die?
        pub lhs_dead: bool,
        /// Did the defender die?
        pub rhs_dead: bool,
        /// Length of the fight in rounds
        rounds: u8,
        /// Random seed the fight was generated with
        seed: u64,
        /// Attackers ships lost
        ships_lost_lhs: [u8; MAX_SHIPS],
        /// Defenders ships lost
        ships_lost_rhs: [u8; MAX_SHIPS]
    }

    pub fn prepare_ships() -> Vec<Ship> {
        let mut ships: Vec<Ship> = Vec::new();

        /// Initialize default ships
        ships.push(Ship {
            cp: 1,
            hp: 120,
            attack_base: 80,
            attack_variable: 20,
            defence: 20,
            speed: 4,
            range: 4,
        });
        ships.push(Ship {
            cp: 3,
            hp: 150,
            attack_base: 65,
            attack_variable: 20,
            defence: 30,
            speed: 3,
            range: 8,
        });
        ships.push(Ship {
            cp: 4,
            hp: 220,
            attack_base: 65,
            attack_variable: 20,
            defence: 35,
            speed: 2,
            range: 15,
        });
        ships.push(Ship {
            cp: 10,
            hp: 450,
            attack_base: 80,
            attack_variable: 20,
            defence: 40,
            speed: 1,
            range: 30,
        });

        ships
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

        /// Return minimum of two i32 values
        fn min(&self, lhs: i32, rhs: i32) -> i32 {
            let result: i32;

            if lhs > rhs {
                result = rhs;
            } else {
                result = lhs;
            }

            result
        }

        /// Return maximum of two i32 values
        fn max(&self, lhs: i32, rhs: i32) -> i32 {
            let result: i32;

            if lhs > rhs {
                result = lhs;
            } else {
                result = rhs;
            }

            result
        }

        /// Checks whether player is dead, according to their ship hp's
        ///
        /// # Arguments
        ///
        /// * `ship_hps` - An array of fleet HPs of the player
        ///
        /// # Returns
        ///
        /// * `is_dead` - Whether the player fleet is dead
        fn is_dead(&self, ship_hps: [i32; MAX_SHIPS]) -> bool {
            let mut is_target_dead: bool = true;

            for i in 0..MAX_SHIPS {
                if ship_hps[i] > 0 {
                    is_target_dead = false;
                }
            }

            is_target_dead
        }

        /// Gets the defence stat of a ship, modified by the variant (fitting)
        ///
        /// # Arguments
        ///
        /// * `stat` - Base ship statistic to modify
        /// * `variant` - Ship variant, 0=Neutral, 1=Defensive, 2=Offensive
        ///
        /// # Returns
        ///
        /// * `final_stat` - The modified defence stat
        fn get_defence_stat(&self, stat: u16, variant: u8) -> u16 {
            let mut final_stat: u16 = 0;

            match variant {
                0 => final_stat = stat,
                1 => final_stat = stat + FIT_TO_STAT,
                2 => final_stat = stat - FIT_TO_STAT,
                _ => (),
            }

            final_stat
        }

        /// Gets the attack stat of a ship, modified by the variant (fitting)
        ///
        /// # Arguments
        ///
        /// * `stat` - Base ship statistic to modify
        /// * `variant` - Ship variant, 0=Neutral, 1=Defensive, 2=Offensive
        ///
        /// # Returns
        ///
        /// * `final_stat` - The modified attack stat
        fn get_attack_stat(&self, stat: u16, variant: u8) -> u16 {
            let mut final_stat: u16 = 0;

            match variant {
                0 => final_stat = stat,
                1 => final_stat = stat - FIT_TO_STAT,
                2 => final_stat = stat + FIT_TO_STAT,
                _ => (),
            }

            final_stat
        }

        /// Picks a target for a ship.
        ///
        /// # Arguments
        ///
        /// * `ships` - A Vec that holds the definiton of all the ships
        /// * `current_ship` - Index of the ship to pick target for
        /// * `ship_positions_own` - An array of fleet positions of the player performing the move
        /// * `ship_positions_enemy` - An array of fleet positions of the player NOT performing the move
        /// * `ship_hps_own` - An array of fleet HPs of the player performing the move
        /// * `ship_hps_enemy` - An array of fleet HPs of the player NOT performing the move
        ///
        /// # Returns
        ///
        /// * `has_target` - A bool, indicating whether a target has been found
        /// * `target` - Target ship identifier
        /// * `proposed_move` - The new source ship position (can be unchanged)
        ///
        /// # Algorithm rules:
        ///     1. To be considered in range, target ship must be within range+speed from source ship
        ///     2. Targets are picked according to their size, ie bigger ships first
        fn get_target(&self, ships: &Vec<Ship>, current_ship: u8,
            ship_positions_own: [i8; MAX_SHIPS], ship_positions_enemy: [i8; MAX_SHIPS],
            ship_hps_enemy: [i32; MAX_SHIPS]) -> (bool, u8, u8) {

            let current_ship_usize:usize = current_ship as usize;
            let position:i8 = ship_positions_own[current_ship_usize];
            let mut proposed_move:u8 = 0;
            let mut min_distance_index:u8 = MAX_SHIPS as u8;

            for enemy_ship in (0..MAX_SHIPS as u8).rev() {
                let enemy_ship_usize:usize = enemy_ship as usize;
                let delta:u8 = (position - ship_positions_enemy[enemy_ship_usize]).abs() as u8;

                if (delta <= ships[current_ship_usize].range + ships[current_ship_usize].speed) &&
                    ship_hps_enemy[current_ship_usize] > 0 {

                    /// We have found a target
                    min_distance_index = enemy_ship;
                    /// Do we need to move?
                    if delta > ships[current_ship_usize].range {
                        proposed_move = delta - ships[current_ship_usize].range;
                    } else {
                        proposed_move = 0;
                    }

                    break;
                }
            }

            (min_distance_index < (MAX_SHIPS as u8), min_distance_index, proposed_move)
        }

        /// Calculate damage done by a ship to another ship.
        ///
        /// # Arguments
        ///
        /// * `variables` - An array that holds the precalculated variable damage coefficients
        /// * `variants_source` - An array that holds variants of the fleet of the player shooting
        /// * `variants_target` - An array that holds variants of the fleet of the player NOT shooting
        /// * `ships` - A Vec that holds the definiton of all the ships
        /// * `source` - Index of the ship shooting
        /// * `target` - Index of the ship being shot at
        /// * `source_hp` - HPs left, of the shooting ship
        ///
        /// # Returns
        ///
        /// * `damage` - The calculated damage
        fn calculate_damage(&self, variables: [u16; MAX_SHIPS], variants_source: [u8; MAX_SHIPS],
            variants_target: [u8; MAX_SHIPS], ships: &Vec<Ship>, source: u8,
            target: u8, source_hp: u32) -> u32 {

            let source_usize: usize = source as usize;
            let target_usize: usize = target as usize;
            let attack: u16 = self.get_attack_stat(ships[source_usize].attack_base,
                variants_source[source_usize]) + variables[source_usize];
            let source_ships_count: u16 = (source_hp / ships[source_usize].hp as u32) as u16 + 1;
            let cap_damage: u32 = (source_ships_count as u32) * (ships[target_usize].hp as u32);
            let mut damage: u32 = (attack - self.get_defence_stat(ships[target_usize].defence, variants_target[target_usize])) as u32 *
                (source_ships_count as u32);

            /// Hard counter mechanic
            /// Increase the damage +50% to smaller ships directly below the ship
            if ((source as i8) - (target as i8) == 1) ||
                (source == 0 && target == MAX_SHIPS as u8 - 1) {

                damage *= damage / 2;
            }

            return self.min(self.max(0, damage as i32), cap_damage as i32) as u32;
        }

        /// Logs the Shoot move into the moves array.
        ///
        /// # Arguments
        ///
        /// * `round` - Round in which the move took place
        /// * `moves` - The Moves array to modify (mutable)
        /// * `source` - Index of the ship performing the move
        /// * `target` - Index of the target ship
        /// * `damage` - Damage inflicted
        /// * `position` - New ship position (can be unchanged)
        fn log_shoot(&self, round: u8, moves: &mut Vec<Move>,
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

        /// Logs the Reposition move into the moves array.
        ///
        /// # Arguments
        ///
        /// * `round` - Round in which the move took place
        /// * `moves` - The Moves array to modify (mutable)
        /// * `source` - Index of the ship performing the move
        /// * `target` - Index of the target ship
        /// * `damage` - Damage inflicted
        /// * `position` - New ship position (can be unchanged)
        fn log_move(&self, round: u8, moves: &mut Vec<Move>,
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

        /// Calculates a fight.
        ///
        /// # Arguments
        ///
        /// * `seed` - Seed used to generate randomness
        /// * `log_moves` - Whether to return a detailed fight log
        /// * `ships` - A Vec that holds the definiton of all the ships
        /// * `selection_lhs` - Attacker fleet composition (array with ship quantities)
        /// * `selection_rhs` - Defender fleet composition (array with ship quantities)
        /// * `variants_lhs` - An array that holds variants of the attacker fleet
        /// * `variants_rhs` - An array that holds variants of the defender fleet
        /// * `commander_lhs` - The attacker commander
        /// * `commander_rhs` - The defender commander
        ///
        /// # Returns
        ///
        /// * `result` - A FightResult structure containing the result
        /// * `moves_lhs` - Logged moves of the attacker, if requested. None if not.
        /// * `moves_rhs` - Logged moves of the defender, if requested. None if not.
        ///
        /// # Algorithm rules:
        ///     1. A fight is divided into rounds.
        ///     2. Each round, ships perform moves in turns, starting from smallest ships.
        ///     3. In each round, the same type of ship, of both the attacker and defender,
        ///        attacks at the same time.
        ///     4. Ships can move, shoot, or both, depending on their Range and Speed.
        ///     5. The winner is declared when one player is dead, or when the fight is still not finished
        ///        after maximum number of rounds.
        #[ink(message)]
        pub fn fight(&self, seed: u64, log_moves: bool, ships: Vec<Ship>,
            selection_lhs: [u8; MAX_SHIPS], selection_rhs: [u8; MAX_SHIPS],
            variants_lhs: [u8; MAX_SHIPS], variants_rhs: [u8; MAX_SHIPS],
            commander_lhs: u8, commander_rhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            /// Starting ship positions for both sides
            let mut ship_positions_lhs: [i8; MAX_SHIPS] = [10, 11, 12, 13];
            let mut ship_positions_rhs: [i8; MAX_SHIPS] = [-10, -11, -12, -13];
            /// Current ship HPs, per ship type
            let mut ship_hps_lhs: [i32; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut ship_hps_rhs: [i32; MAX_SHIPS] = [0; MAX_SHIPS];
            /// Precalculated variable damage coefficients
            let mut variables_lhs: [u16; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut variables_rhs: [u16; MAX_SHIPS] = [0; MAX_SHIPS];

            /// Precalculate the variables and initialize the ship HPs
            for i in 0..MAX_SHIPS {
                ship_hps_lhs[i] = (ships[i].hp as i32) * (selection_lhs[i] as i32);
                ship_hps_rhs[i] = (ships[i].hp as i32) * (selection_rhs[i] as i32);
                variables_lhs[i] = (seed % ships[i].attack_variable as u64) as u16;
                variables_rhs[i] = ((seed / 2) % ships[i].attack_variable as u64) as u16;
            }

            let mut lhs_moves: Option<Vec<Move>> = None;
            let mut rhs_moves: Option<Vec<Move>> = None;
            let mut total_rounds: u8 = 0;

            /// Only initialize the moves when required, to save gas
            if log_moves {
                lhs_moves = Some(Vec::new());
                rhs_moves = Some(Vec::new());
            }

            /// Loop intented to be broken out of if resolution is found quicker than MAX_ROUNDS
            for round in 0..MAX_ROUNDS {
                if self.is_dead(ship_hps_lhs) || self.is_dead(ship_hps_rhs) {
                    break;
                }

                let round_u8: u8 = round as u8;
                total_rounds = total_rounds + 1;

                /// Loop through all the ships
                for current_ship in 0..MAX_SHIPS {
                    let current_ship_u8: u8 = current_ship as u8;
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

                    /// Note, moving and dealing damage to attacker is delayed until defender has moved also
                    if !lhs_dead_ship {
                        (lhs_has_target, lhs_target, lhs_delta_move) = self.get_target(
                            &ships, current_ship_u8, ship_positions_lhs, ship_positions_rhs, ship_hps_rhs);

                        if lhs_has_target {
                            lhs_damage = self.calculate_damage(variables_lhs, variants_lhs, variants_rhs,
                                &ships, current_ship_u8, lhs_target, ship_hps_lhs[current_ship] as u32);

                            /// Log the move, if required
                            match lhs_moves {
                                Some(ref mut moves) =>
                                    self.log_shoot(round_u8, moves, current_ship_u8, lhs_target, lhs_damage,
                                        ship_positions_lhs[current_ship] - (lhs_delta_move as i8)),
                                _ => ()
                            }
                        } else {
                            /// Log the move, if required
                            match lhs_moves {
                                Some(ref mut moves) =>
                                    self.log_move(round_u8, moves, current_ship_u8, ship_positions_lhs[current_ship] -
                                        (ships[current_ship].speed as i8)),
                                _ => ()
                            }
                        }
                    }

                    if !rhs_dead_ship {
                        (rhs_has_target, rhs_target, rhs_delta_move) = self.get_target(
                            &ships, current_ship_u8, ship_positions_rhs, ship_positions_lhs, ship_hps_lhs);

                        if rhs_has_target {
                            rhs_damage = self.calculate_damage(variables_rhs, variants_rhs, variants_lhs,
                                &ships, current_ship_u8, rhs_target, ship_hps_rhs[current_ship] as u32);

                            /// Move the ships, apply the damage
                            ship_hps_lhs[rhs_target as usize] -= rhs_damage as i32;
                            ship_positions_rhs[current_ship] += rhs_delta_move as i8;

                            /// Log the move, if required
                            match rhs_moves {
                                Some(ref mut moves) =>
                                    self.log_shoot(round_u8, moves, current_ship_u8, rhs_target, rhs_damage,
                                        ship_positions_rhs[current_ship]),
                                _ => ()
                            }
                        } else {
                            /// Move the ships
                            ship_positions_rhs[current_ship] += ships[current_ship].speed as i8;

                            /// Log the move, if required
                            match rhs_moves {
                                Some(ref mut moves) =>
                                    self.log_move(round_u8, moves, current_ship_u8,
                                        ship_positions_rhs[current_ship]),
                                _ => ()
                            }
                        }
                    }

                    /// Now applying attacker moves
                    if !lhs_dead_ship {
                        if lhs_has_target {
                            /// Move the ships, apply the damage
                            ship_hps_rhs[lhs_target as usize] -= lhs_damage as i32;
                            ship_positions_lhs[current_ship] -= lhs_delta_move as i8;
                        } else {
                            /// Move the ships
                            ship_positions_lhs[current_ship] -= ships[current_ship].speed as i8;
                        }
                    }
                }
            }

            /// Calculate ships lost according to HPs left
            let mut ships_lost_lhs: [u8; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut ships_lost_rhs: [u8; MAX_SHIPS] = [0; MAX_SHIPS];
            for i in 0..MAX_SHIPS {
                let safe_hp_lhs: u32 = self.max(ship_hps_lhs[i], 0) as u32;
                let safe_hp_rhs: u32 = self.max(ship_hps_rhs[i], 0) as u32;
                ships_lost_lhs[i] = (((selection_lhs[i] as u32 * ships[i].hp as u32) - safe_hp_lhs) / ships[i].hp as u32) as u8;
                ships_lost_rhs[i] = (((selection_rhs[i] as u32 * ships[i].hp as u32) - safe_hp_rhs) / ships[i].hp as u32) as u8;
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
                lhs_dead: total_rhs_ships > 0 && self.is_dead(ship_hps_lhs),
                rhs_dead: self.is_dead(ship_hps_rhs),
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
        fn test_fight_end_to_end() {
            let contract = NewOmega::default();
            let ships: Vec<Ship> = prepare_ships();
            let seed: u64 = 1337;
            let log_moves: bool = true;
            let selection_lhs: [u8; MAX_SHIPS] = [10, 10, 10, 10];
            let selection_rhs: [u8; MAX_SHIPS] = [5, 5, 5, 5];
            let variants_lhs: [u8; MAX_SHIPS] = [0, 1, 2, 0];
            let variants_rhs: [u8; MAX_SHIPS] = [1, 0, 1, 2];
            let commander_lhs: u8 = 0;
            let commander_rhs: u8 = 1;

            let (result, _moves_lhs, _moves_rhs) = contract.fight(seed, log_moves, ships,
                selection_lhs, selection_rhs, variants_lhs, variants_rhs,
                commander_lhs, commander_rhs);

            assert!(result.rhs_dead);
        }

        #[test]
        fn test_damage_calculation() {
            let contract = NewOmega::default();
            let ships: Vec<Ship> = prepare_ships();
            let variants_source: [u8; MAX_SHIPS] = [0, 1, 2, 0];
            let variants_target: [u8; MAX_SHIPS] = [2, 0, 1, 1];
            let variables: [u16; MAX_SHIPS] = [0, 1, 2, 3];
            let source: u8 = 0;
            let target: u8 = 0;
            let source_hp: u32 = ships[source as usize].hp as u32;
            let damage: u32 = contract.calculate_damage(variables, variants_source,
                variants_target, &ships, source, target, source_hp);

            assert_eq!(damage, 160);
        }

        #[test]
        fn test_isdead() {
            let contract = NewOmega::default();
            let alive_ship_hps: [i32; MAX_SHIPS] = [20, -20, 0, 0];
            let is_dead_first: bool = contract.is_dead(alive_ship_hps);

            assert_eq!(is_dead_first, false);

            let dead_ship_hps: [i32; MAX_SHIPS] = [-100, -20, 0, 0];
            let is_dead_second: bool = contract.is_dead(dead_ship_hps);

            assert_eq!(is_dead_second, true);
        }
    }
}
