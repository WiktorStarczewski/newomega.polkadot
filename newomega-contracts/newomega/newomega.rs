#![feature(destructuring_assignment)]
#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod GameEngineLibrary {
    #[ink(storage)]
    pub struct GameEngineLibrary {}

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
        moveType: u8,
        round: u8,
        source: u8,
        target: u8,
        targetPosition: i8,
        damage: u32
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
    pub struct Ship {
        cp: u16,
        hp: u16,
        attackBase: u16,
        attackVariable: u16,
        defence: u16,
        speed: u8,
        range: u8
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
        selectionLhs: [u8; MAX_SHIPS],
        selectionRhs: [u8; MAX_SHIPS],
        variantsLhs: [u8; MAX_SHIPS],
        variantsRhs: [u8; MAX_SHIPS],
        commanderLhs: u8,
        commanderRhs: u8,
        lhsDead: bool,
        rhsDead: bool,
        rounds: u8,
        seed: u64,
        shipsLostLhs: [u8; MAX_SHIPS],
        shipsLostRhs: [u8; MAX_SHIPS]
    }

    impl GameEngineLibrary {
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

        fn getTarget(&self, Ships: &[Ship; MAX_SHIPS], currentShip: u8,
            shipPositionsOwn: [i8; MAX_SHIPS], shipPositionsEnemy: [i8; MAX_SHIPS],
            shipHpsEnemy: [i32; MAX_SHIPS]) -> (bool, u8, u8) {

            let currentShipUsize:usize = currentShip as usize;
            let position:i8 = shipPositionsOwn[currentShipUsize];
            let mut proposedMove:u8 = 0;
            let mut minDistanceIndex:u8 = MAX_SHIPS as u8;

            for enemyShip in (0..MAX_SHIPS as u8).rev() {
                let enemyShipUsize:usize = enemyShip as usize;
                let delta:u8 = (position - shipPositionsEnemy[enemyShipUsize]).abs() as u8;

                if (delta <= Ships[currentShipUsize].range + Ships[currentShipUsize].speed) &&
                    shipHpsEnemy[currentShipUsize] > 0 {

                    minDistanceIndex = enemyShip;
                    if delta > Ships[currentShipUsize].range {
                        proposedMove = delta - Ships[currentShipUsize].range;
                    } else {
                        proposedMove = 0;
                    }

                    break;
                }
            }

            (minDistanceIndex < (MAX_SHIPS as u8), minDistanceIndex, proposedMove)
        }

        fn calculateDamage(&self, variables: [u16; MAX_SHIPS], variantsSource: [u8; MAX_SHIPS],
            variantsTarget: [u8; MAX_SHIPS], Ships: &[Ship; MAX_SHIPS], source: u8,
            target: u8, sourceHp: u32) -> u32 {

            let sourceUsize: usize = source as usize;
            let targetUsize: usize = target as usize;
            let attack: u16 = self.getAttackStat(Ships[sourceUsize].attackBase,
                variantsSource[sourceUsize]) + variables[sourceUsize];
            let sourceShipsCount: u16 = (sourceHp / Ships[sourceUsize].hp as u32) as u16 + 1;
            let capDamage: u32 = (sourceShipsCount as u32) * (Ships[targetUsize].hp as u32);
            let mut damage: u32 = (attack - self.getDefenceStat(Ships[targetUsize].defence, variantsTarget[targetUsize])) as u32 *
                (sourceShipsCount as u32);

            if ((source as i8) - (target as i8) == 1) ||
                (source == 0 && target == MAX_SHIPS as u8 - 1) {

                damage *= damage / 2;
            }

            return self.min(self.max(0, damage as i32), capDamage as i32) as u32;
        }

        fn logShoot(&self, moveNumber: &mut u16, round: u8, moves: &mut Vec<Move>,
            source: u8, target: u8, damage: u32, position: i8) {

            moves.push(Move {
                moveType: 1,
                round: round,
                source: source,
                target: target,
                damage: damage,
                targetPosition: position
            });
        }

        fn logMove(&self, moveNumber: &mut u16, round: u8, moves: &mut Vec<Move>,
            source: u8, targetPosition: i8) {

            moves.push(Move {
                moveType: 2,
                round: round,
                source: source,
                targetPosition: targetPosition,
                target: 0,
                damage: 0
            });
        }

        #[ink(message)]
        pub fn fight(&self, seed: u64, logMoves: bool, Ships: [Ship; MAX_SHIPS],
            selectionLhs: [u8; MAX_SHIPS], selectionRhs: [u8; MAX_SHIPS],
            variantsLhs: [u8; MAX_SHIPS], variantsRhs: [u8; MAX_SHIPS],
            commanderLhs: u8, commanderRhs: u8) -> (FightResult, Option<Vec<Move>>,
                Option<Vec<Move>>) {

            let mut shipPositionsLhs: [i8; MAX_SHIPS] = [10, 11, 12, 13];
            let mut shipPositionsRhs: [i8; MAX_SHIPS] = [-10, -11, -12, -13];
            let mut shipHpsLhs: [i32; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut shipHpsRhs: [i32; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut variablesLhs: [u16; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut variablesRhs: [u16; MAX_SHIPS] = [0; MAX_SHIPS];

            for i in 0..MAX_SHIPS {
                shipHpsLhs[i] = (Ships[i].hp as i32) * (selectionLhs[i] as i32);
                shipHpsRhs[i] = (Ships[i].hp as i32) * (selectionRhs[i] as i32);
                variablesLhs[i] = (seed % Ships[i].attackVariable as u64) as u16;
                variablesRhs[i] = ((seed / 2) % Ships[i].attackVariable as u64) as u16;
            }

            let mut lhsMoves: Option<Vec<Move>> = None;
            let mut rhsMoves: Option<Vec<Move>> = None;
            let mut totalRounds: u8 = 0;

            let emptyMove: Move = Move {
                moveType: 0,
                round: 0,
                damage: 0,
                source: 0,
                target: 0,
                targetPosition: 0,
            };

            if logMoves {
                lhsMoves = Some(Vec::new());
                rhsMoves = Some(Vec::new());
            }

            for round in 0..MAX_ROUNDS {
                if self.isDead(shipHpsLhs) || self.isDead(shipHpsRhs) {
                    break;
                }

                let roundU8: u8 = round as u8;
                totalRounds = totalRounds + 1;

                for currentShip in 0..MAX_SHIPS {
                    let currentShipU8: u8 = currentShip as u8;
                    let mut lhsHasTarget: bool = false;
                    let mut rhsHasTarget: bool = false;
                    let lhsDeadShip: bool = shipHpsLhs[currentShip] <= 0;
                    let rhsDeadShip: bool = shipHpsRhs[currentShip] <= 0;
                    let mut lhsDamage: u32 = 0;
                    let mut rhsDamage: u32 = 0;
                    let mut lhsTarget: u8 = 0;
                    let mut rhsTarget: u8 = 0;
                    let mut lhsDeltaMove: u8 = 0;
                    let mut rhsDeltaMove: u8 = 0;
                    let mut lhsMoveNumber: u16 = 0;
                    let mut rhsMoveNumber: u16 = 0;

                    if !lhsDeadShip {
                        (lhsHasTarget, lhsTarget, lhsDeltaMove) = self.getTarget(
                            &Ships, currentShipU8, shipPositionsLhs, shipPositionsRhs, shipHpsRhs);

                        if lhsHasTarget {
                            lhsDamage = self.calculateDamage(variablesLhs, variantsLhs, variantsRhs,
                                &Ships, currentShipU8, lhsTarget, shipHpsLhs[currentShip] as u32);

                            match lhsMoves {
                                Some(ref mut moves) =>
                                    self.logShoot(&mut lhsMoveNumber, roundU8, moves, currentShipU8, lhsTarget, lhsDamage,
                                        shipPositionsLhs[currentShip] - (lhsDeltaMove as i8)),
                                None => {}
                            }
                        } else {
                            match lhsMoves {
                                Some(ref mut moves) =>
                                    self.logMove(&mut lhsMoveNumber, roundU8, moves, currentShipU8, shipPositionsLhs[currentShip] -
                                        (Ships[currentShip].speed as i8)),
                                None => {}
                            }
                        }
                    }

                    if !rhsDeadShip {
                        (rhsHasTarget, rhsTarget, rhsDeltaMove) = self.getTarget(
                            &Ships, currentShipU8, shipPositionsRhs, shipPositionsLhs, shipHpsLhs);

                        if rhsHasTarget {
                            rhsDamage = self.calculateDamage(variablesRhs, variantsRhs, variantsLhs,
                                &Ships, currentShipU8, rhsTarget, shipHpsRhs[currentShip] as u32);
                            shipHpsLhs[rhsTarget as usize] -= rhsDamage as i32;
                            shipPositionsRhs[currentShip] += rhsDeltaMove as i8;

                            match rhsMoves {
                                Some(ref mut moves) =>
                                    self.logShoot(&mut rhsMoveNumber, roundU8, moves, currentShipU8, rhsTarget, rhsDamage,
                                        shipPositionsRhs[currentShip]),
                                None => {}
                            }
                        } else {
                            shipPositionsRhs[currentShip] += Ships[currentShip].speed as i8;

                            match rhsMoves {
                                Some(ref mut moves) =>
                                    self.logMove(&mut rhsMoveNumber, roundU8, moves, currentShipU8,
                                        shipPositionsRhs[currentShip]),
                                None => {}
                            }
                        }
                    }

                    if !lhsDeadShip {
                        if lhsHasTarget {
                            shipHpsRhs[lhsTarget as usize] -= lhsDamage as i32;
                            shipPositionsLhs[currentShip] -= lhsDeltaMove as i8;
                        } else {
                            shipPositionsLhs[currentShip] -= Ships[currentShip].speed as i8;
                        }
                    }
                }
            }

            let mut shipsLostLhs: [u8; MAX_SHIPS] = [0; MAX_SHIPS];
            let mut shipsLostRhs: [u8; MAX_SHIPS] = [0; MAX_SHIPS];
            for i in 0..MAX_SHIPS {
                let safeHpLhs: u32 = self.max(shipHpsLhs[i], 0) as u32;
                let safeHpRhs: u32 = self.max(shipHpsRhs[i], 0) as u32;
                shipsLostLhs[i] = (((selectionLhs[i] as u32 * Ships[i].hp as u32) - safeHpLhs) / Ships[i].hp as u32) as u8;
                shipsLostRhs[i] = (((selectionRhs[i] as u32 * Ships[i].hp as u32) - safeHpRhs) / Ships[i].hp as u32) as u8;
            }

            let mut totalRhsShips: u16 = 0;
            for i in 0..MAX_SHIPS {
                totalRhsShips += selectionRhs[i] as u16;
            }

            let result: FightResult = FightResult {
                selectionLhs: selectionLhs,
                selectionRhs: selectionRhs,
                variantsLhs: variantsLhs,
                variantsRhs: variantsRhs,
                commanderLhs: commanderLhs,
                commanderRhs: commanderRhs,
                lhsDead: totalRhsShips > 0 && self.isDead(shipHpsLhs),
                rhsDead: self.isDead(shipHpsRhs),
                shipsLostLhs: shipsLostLhs,
                shipsLostRhs: shipsLostRhs,
                rounds: totalRounds,
                seed: seed
            };

            (result, lhsMoves, rhsMoves)
        }
    }


    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn default_works() {
            let contract = GameEngineLibrary::default();
            assert_eq!(contract.get(), 0);
        }

        #[test]
        fn it_works() {
            let mut contract = GameEngineLibrary::new();
        }
    }
}
