import React, { useState, useEffect, useRef } from 'react';
import _ from 'underscore';
import { Engine, Scene, Vector3, Color3, Mesh, AssetsManager, StandardMaterial, ParticleHelper, Layer,
    Animation, ArcRotateCamera, HemisphericLight } from '@babylonjs/core';
import '@babylonjs/loaders';
import { Ships } from '../definitions/Ships';
import { Commanders } from '../definitions/Commanders';
import { OmegaLoadingScreen } from '../common/OmegaLoadingScreen';
import './Combat.css';

const LASER_LENGTH_MS = 500;
const SHOOT_GAP_MS = 500;
const LHS_COLOR = Color3.Yellow();
const RHS_COLOR = Color3.Green();

// props: selectionLhs, selectionRhs, commanderLhs, commanderRhs, result
export const Combat = (props) => {
    const [ round, setRound ] = useState(0);
    const [ showingResult, setShowingResult ] = useState(false);
    const [ combatLog, setCombatLog ] = useState('');
    const [ resourcesLoaded, setResourcesLoaded ] = useState(false);
    const [ interrupt ] = useState({});
    const reactCanvas = useRef(null);
    let shipMeshesLhs = [ [], [], [], [] ];
    let shipMeshesRhs = [ [], [], [], [] ];

    const afterImportMeshes = (scene, newMeshes, currentShip,
        basePosition, count, direction, isLhs) => {

        const rotationModifierY = Ships[currentShip].visuals.rotationModifierY || 1;
        const rotationOddOffsetY = Ships[currentShip].visuals.rotationOddOffsetY > 0
            ? Ships[currentShip].visuals.rotationOddOffsetY
            : 0;

        newMeshes[0].position = new Vector3(basePosition + currentShip * direction, 0, 0);
        newMeshes[0].rotation = new Vector3(
            Math.PI,
            (-Math.PI / 2 * direction * rotationModifierY) + (direction < 0 ? rotationOddOffsetY : 0),
            Math.PI * -direction);
        newMeshes[0].scalingDeterminant = 0.0001 * Ships[currentShip].scale;

        _.each(newMeshes, (newMesh) => {
            newMesh.material = new StandardMaterial(_.uniqueId(), scene);
            newMesh.material.diffuseColor = isLhs
                ? new Color3(0.612, 0.8, 0.396)
                : new Color3(1, 0.79, 0.16)
        });

        if (isLhs) {
            shipMeshesLhs[currentShip] = [ newMeshes[0] ];
        } else {
            shipMeshesRhs[currentShip] = [ newMeshes[0] ];
        }

        for (let i = 0; i < count - 1; i++) {
            const clonedMesh = newMeshes[0].clone();

            if (i % 2 === 0) {
                clonedMesh.position.z -= (Math.floor(i / 2) + 1) * Ships[currentShip].combatScale;
            } else {
                clonedMesh.position.z += (Math.floor(i / 2) + 1) * Ships[currentShip].combatScale;
            }

            if (isLhs) {
                shipMeshesLhs[currentShip].push(clonedMesh);
            } else {
                shipMeshesRhs[currentShip].push(clonedMesh);
            }
        }
    };


    const loadResources = (scene) => {
        return new Promise((resolve, reject) => {
            const assetsManager = new AssetsManager(scene);

            _.each(props.result.selection_lhs, (count, index) => {
                if (count > 0) {
                    shipMeshesLhs[index] = [];
                    const task = assetsManager.addMeshTask(index, '',
                        Ships[index].asset,
                        Ships[index].sceneFile || 'scene.gltf');
                    task.onSuccess = (task) => {
                        afterImportMeshes(scene, task.loadedMeshes, index, 10, count, 1, true);
                    };
                }
            });

            _.each(props.result.selection_rhs, (count, index) => {
                if (count > 0) {
                    shipMeshesRhs[index] = [];
                    const task = assetsManager.addMeshTask(index, '',
                        Ships[index].asset,
                        'scene.gltf');
                    task.onSuccess = (task) => {
                        afterImportMeshes(scene, task.loadedMeshes, index, -10, count, -1, false);
                    };
                }
            });

            assetsManager.onFinish = (tasks) => {
                resolve();
            };

            assetsManager.load();
        });
    };

    const moveShips = (scene, move, isLhs) => {
        const meshes = isLhs ? shipMeshesLhs[move.source] : shipMeshesRhs[move.source];
        const alreadyThereLhs = _.filter(shipMeshesLhs, (meshes) => {
            return meshes[0] && meshes[0].position.x === move.target_position;
        });
        const alreadyThereRhs = _.filter(shipMeshesRhs, (meshes) => {
            return meshes[0] && meshes[0].position.x === move.target_position;
        });
        const alreadyThere = alreadyThereLhs.length + alreadyThereRhs.length;

        const posYLhs = _.map(alreadyThereLhs, (meshes) => {
            return meshes[0] ? meshes[0].position.y : Number.MAX_SAFE_INTEGER;
        });
        const posYRhs = _.map(alreadyThereRhs, (meshes) => {
            return meshes[0] ? meshes[0].position.y : Number.MAX_SAFE_INTEGER;
        });

        let targetY = alreadyThere;
        for (let proposalY = 0; proposalY < alreadyThere; proposalY++) {
            if (!_.contains(posYLhs, proposalY) &&
                !_.contains(posYRhs, proposalY)) {
                targetY = proposalY;
            }
        }

        return Promise.all(_.map(meshes, (mesh) => {
            return new Promise((resolve/*, reject*/) => {
                if (mesh.position.x === move.target_position) {
                    return resolve();
                }

                const framerate = 10;
                const slide = new Animation(_.uniqueId(), 'position.x', framerate,
                    Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
                const direction = isLhs ? -1 : 1;
                const keyFrames = [
                    {
                        frame: 0,
                        value: mesh.position.x,
                    },
                    {
                        frame: framerate,
                        value: mesh.position.x + Math.abs(move.target_position - mesh.position.x) * direction,
                    },
                    {
                        frame: 2*framerate,
                        value: move.target_position,
                    }
                ];
                slide.setKeys(keyFrames);

                const adjustY = new Animation(_.uniqueId(), 'position.y', framerate,
                    Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
                const keyFramesAdjustY = [
                    {
                        frame: 0,
                        value: mesh.position.y,
                    },
                    {
                        frame: framerate,
                        value: mesh.position.y + ((targetY - mesh.position.y) / 2),
                    },
                    {
                        frame: 2*framerate,
                        value: targetY,
                    }
                ];
                adjustY.setKeys(keyFramesAdjustY);

                mesh.animations = [ slide, adjustY ];
                scene.beginAnimation(mesh, 0, 2 * framerate, false, 2, resolve);
            });
        }));
    };

    const applyHpsToVisuals = (scene, target, isLhs, shipHpsLhs, shipHpsRhs) => {
        const hpPerShip = Ships[target].stats.hp;
        const hpsLeft = isLhs ? shipHpsRhs[target] : shipHpsLhs[target];
        const shipsLeft = Math.max(Math.ceil(hpsLeft / hpPerShip), 0);
        let meshes = isLhs ? shipMeshesRhs[target] : shipMeshesLhs[target];
        const shipsToRemove = meshes.length - shipsLeft;

        for (let removeIndex = 0; removeIndex < shipsToRemove; removeIndex++) {
            const meshToRemove = meshes.shift();

            // IMPROVEME only createasync once
            // ParticleHelper.CreateAsync('explosion', scene).then((set) => {
            //     set.systems.forEach(s => {
            //         s.worldOffset = meshToRemove.position;
            //         s.disposeOnStop = true;
            //         s.maxSize = 0.01;
            //         s.minSize = 0.001;
            //     });
            //     set.systems = [ set.systems[0] ];
            //     set.start();
            // });

            meshToRemove.dispose();
        }
    };

    let localLog = '';

    const logAttack = (move, isLhs) => {
        const prefix = isLhs ? '[Attacker]' : '[Defender]';
        const newEntry = `${prefix} ${Ships[move.source].name} hits ${Ships[move.target].name} for ${move.damage} damage.`;
        localLog = newEntry + '\n' + localLog;
        setCombatLog(localLog);
    };

    const logRoundStart = (round) => {
        const newEntry = `Round ${round + 1} begins.\n\n`;
        localLog = newEntry + localLog;
        setCombatLog(localLog);
    };

    const showLaser = (scene, source, sourceMesh, targetMesh, isLhs) => {
        const mat = new StandardMaterial('laserMat', scene);
        mat.alpha = 0.6;
        mat.diffuseColor = isLhs ? LHS_COLOR : RHS_COLOR;
        mat.backFaceCulling = false;

        const lines = Mesh.CreateTube('laser', [
            sourceMesh.position,
            targetMesh.position
        ], Ships[source].visuals.beamWidth, 64, null, 0, scene, false, Mesh.FRONTSIDE);
        lines.material = mat;
        lines.convertToFlatShadedMesh();

        setTimeout(() => {
            lines.dispose();
        }, LASER_LENGTH_MS);
    };

    const showAttacks = (scene, move, isLhs) => {
        // for ships, each ship attacks next ship [0..n] meshes
        const sourceMeshes = isLhs ? shipMeshesLhs : shipMeshesRhs;
        const targetMeshes = isLhs ? shipMeshesRhs : shipMeshesLhs;
        _.each(sourceMeshes[move.source], (sourceMesh, ind) => {
            if (!targetMeshes[move.target] || !targetMeshes[move.target].length) {
                return;
            }

            const targetMeshIndex = ind % targetMeshes[move.target].length;
            const targetMesh = targetMeshes[move.target][targetMeshIndex];

            showLaser(scene, move.source, sourceMesh, targetMesh, isLhs);
        });
    };

    const playMove = (scene, move, isLhs, shipHpsLhs, shipHpsRhs) => {
        let movePromise;

        if (!move) {
            return new Promise((resolve) => {
                resolve();
            });
        }

        movePromise = moveShips(scene, move, isLhs);

        if (move.move_type === 1) {
            movePromise = movePromise.then(() => {
                return new Promise((resolve, reject) => {
                    showAttacks(scene, move, isLhs);
                    const shipHps = isLhs ? shipHpsRhs : shipHpsLhs;
                    shipHps[move.target] -= move.damage;
                    applyHpsToVisuals(scene, move.target, isLhs, shipHpsLhs,
                        shipHpsRhs);
                    logAttack(move, isLhs);

                    setTimeout(resolve, SHOOT_GAP_MS);
                });
            });
        }

        return movePromise;
    };

    const playMoves = (scene, lhsMoves, rhsMoves, shipHpsLhs, shipHpsRhs) => {
        const _recursiveMover = (ind, mainResolver) => {
            const lhsMove = lhsMoves[ind];
            const rhsMove = rhsMoves[ind];

            if (interrupt.interrupted) {
                return mainResolver();
            }

            const movePromiseLhs = playMove(scene, lhsMove, true, shipHpsLhs, shipHpsRhs);
            const movePromiseRhs = playMove(scene, rhsMove, false, shipHpsLhs, shipHpsRhs);

            Promise.all([movePromiseLhs, movePromiseRhs]).then(() => {
                if (ind + 1 < Math.max(lhsMoves.length, rhsMoves.length)) {
                    _recursiveMover(ind + 1, mainResolver);
                } else {
                    mainResolver();
                }
            });
        }

        return new Promise((resolve, reject) => {
            _recursiveMover(0, resolve);
        });
    };

    const playRound = (scene, round, shipHpsLhs, shipHpsRhs) => { // recursive
        if (round >= props.result.rounds) {
            setShowingResult(true);
            return;
        }

        if (interrupt.interrupted) {
            return;
        }

        setRound(round);
        logRoundStart(round);

        const lhsMoves = _.filter(props.result.lhs_moves, (move) => {
            return move.round === round && move.move_type !== 0;
        });
        const rhsMoves = _.filter(props.result.rhs_moves, (move) => {
            return move.round === round && move.move_type !== 0;
        });

        const lhsMovesPadded = _.map(_.range(Ships.length), (shipIndex) => {
            return _.findWhere(lhsMoves, {
                source: shipIndex,
            });
        });

        const rhsMovesPadded = _.map(_.range(Ships.length), (shipIndex) => {
            return _.findWhere(rhsMoves, {
                source: shipIndex,
            });
        });

        playMoves(scene, lhsMovesPadded, rhsMovesPadded, shipHpsLhs, shipHpsRhs).then(() => {
            playRound(scene, round + 1, shipHpsLhs, shipHpsRhs);
        });
    };

    const playCombat = (scene) => {
        const shipHpsLhs = _.map(props.result.selection_lhs, (count, index) => {
            return Ships[index].stats.hp * count;
        });
        const shipHpsRhs = _.map(props.result.selection_rhs, (count, index) => {
            return Ships[index].stats.hp * count;
        });

        playRound(scene, 0, shipHpsLhs, shipHpsRhs);
    };

    const onSceneMount = (canvas, scene) => {
        scene.getEngine().loadingScreen = new OmegaLoadingScreen();

        const camera = new ArcRotateCamera('camera1',
            Math.PI / 2, Math.PI / 4, 20, Vector3.Zero(), scene);
        camera.minZ = 0.001;
        camera.lowerRadiusLimit = 8;
        camera.upperRadiusLimit = 20;
        scene.activeCameras.push(camera);
        camera.attachControl(canvas, true);

        const light = new HemisphericLight('light1', new Vector3(0, 0, 1), scene);
        light.intensity = 0.7;

        const background = new Layer('background',
            '/assets/images/jeremy-perkins-uhjiu8FjnsQ-unsplash.jpg', scene);
        background.isBackground = true;
        background.texture.level = 0;
        background.texture.wAng = .2;

        loadResources(scene).then(() => {
            setResourcesLoaded(true);
            playCombat(scene);
        })
    };

    const getWinnerString = () => {
        if (props.result.lhs_dead) {
            return 'Defender Wins';
        } else if (props.result.rhs_dead) {
            return 'Attacker Wins';
        } else {
            return 'Draw';
        }
    }

    const commanderAssetLhs = Commanders[props.result.commander_lhs % Commanders.length].asset
        + 'thumb.png';
    const commanderAssetRhs = Commanders[props.result.commander_rhs % Commanders.length].asset
        + 'thumb.png';

    useEffect(() => {
        if (reactCanvas.current) {
            const engine = new Engine(reactCanvas.current, true, null, true);
            const scene = new Scene(engine);

            if (scene.isReady()) {
                onSceneMount(reactCanvas.current, scene);
            } else {
                scene.onReadyObservable.addOnce(scene => onSceneMount(reactCanvas.current, scene));
            }

            engine.runRenderLoop(() => {
                scene.render();
            })

            const resize = () => {
                scene.getEngine().resize();
            }

            if (window) {
                window.addEventListener('resize', resize);
            }

            return () => {
                scene.getEngine().dispose();
                if (window) {
                    window.removeEventListener('resize', resize);
                }
            }
        }
    }, [reactCanvas]);

    return (
        <div className="Combat">
            <canvas ref={reactCanvas} id="combat"/>
            {resourcesLoaded &&
                <div className="ui">
                    <div className="uiElement commander lhs">
                        <img alt="Commander" src={commanderAssetLhs}>
                        </img>
                    </div>
                    <div className="uiElement commander rhs">
                        <img alt="Commander" src={commanderAssetRhs}>
                        </img>
                    </div>
                    <div className="uiElement currentRound">
                        Round {round+1}
                    </div>
                    <div className="uiElement combatLog">
                        <pre>{combatLog}</pre>
                    </div>
                    <div className="uiElement doneBox bottomBox" onClick={() => {
                        setShowingResult(true);
                        interrupt.interrupted = true;
                    }}>
                        FINISH
                    </div>
                    <div className="miniLogoBox"></div>
                    {showingResult &&
                        <div className="result">
                            <div className="resultDialog">
                                <div className="winner">
                                    {getWinnerString()}
                                </div>
                                <div className="exitButton" onClick={props.onCancel}>
                                    EXIT
                                </div>
                            </div>
                        </div>
                    }
                </div>
            }
        </div>
    );
}
