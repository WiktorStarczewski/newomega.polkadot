import './App.css';
import React, { Component } from 'react';
import { ContractFacade } from './facades/ContractFacade';
import { ShipSelection } from './scenes/ShipSelection';
import { CommanderSelection } from './scenes/CommanderSelection';
import { Combat } from './scenes/Combat';
import { OpponentSelection } from './ui/OpponentSelection';
import { Leaderboard } from './ui/Leaderboard';
import { LoginScreen } from './ui/LoginScreen';
import { Settings } from './ui/Settings';
import { Ships } from './definitions/Ships';
import { OmegaDefaults } from './definitions/OmegaDefaults';
import Snackbar from '@material-ui/core/Snackbar';
import SettingsIcon from '@material-ui/icons/Settings';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';
import _ from 'underscore';


/**
 * Enumerates all modes the game can be in.
 */
const Modes = {
    PlayingVideo: 0,
    LoginScreen: 1,
    MainScreen: 2,
    ShipSelection: 3,
    CommanderSelection: 4,
    CommanderPreview: 5,
    Combat: 6,
    OpponentSelection: 7,
    Leaderboard: 8,
    Settings: 9,
};

/**
 * Default fleet selection to train against
 */
const TRAINING_SELECTION = [35, 25, 15, 10];

/**
 * Variants of the default fleet selection to train against
 */
const DEFAULT_VARIANTS = [0, 0, 0, 0];



export default class OmegaApp extends Component {
    constructor(props) {
        super(props);

        this.defaultLoadedState = {
            mode: Modes.MainScreen,
            loading: false,
            trainingSelfSelection: null,
            trainingResult: null,
            trainingSelfCommander: null,
            trainingOpponent: null,
            trainingOpponentSelection: null,
            trainingOpponentCommander: null,
            trainingCp: null,
            defenders: null,
            leaderboard: null,
            settingDefence: false,
            settingAttack: false,
            ownCommanders: null,
        };

        this.defaultUnloadedState = {
            mode: Modes.PlayingVideo,
            ownAccount: null,
            ethBalance: 0,
            blockNumber: 0,
            newOmegaContract: null,
            hasUnseenFights: false,
            toastOpen: false,
            toastContent: '',
            playerName: window.localStorage.getItem('OmegaPlayerName') || 'Anonymous',
        };

        this.state = {
            ...this.defaultLoadedState,
            ...this.defaultUnloadedState,
        };
    }

    /**
     * Handler for the ship selection done action.
     * Moves to the commander selection stage.
     */
    async shipSelectionDone(selection) {
        let commanders;

        try {
            commanders = await this.state.contractFacade.getCommanders();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get Commanders).',
            });
        }

        this.setState({
            mode: Modes.CommanderSelection,
            trainingSelfSelection: selection,
            ownCommanders: commanders,
        });
    }

    /**
     * Handler for the commander selection done action.
     * Follows up with the original action that triggered
     * the commander selection.
     */
    async commanderSelectionDone(commander) {
        this.setState({
            loading: true,
        });

        if (this.state.settingDefence) {
            try {
                await this.state.contractFacade.registerDefence(
                    this.state.trainingSelfSelection,
                    DEFAULT_VARIANTS,
                    commander,
                    this.state.playerName
                );
            } catch (error) {
                this.setState({
                    toastOpen: true,
                    toastContent: 'Transaction failed (Defence).',
                });
            }
        } else if (this.state.settingAttack) {
            let result;
            try {
                result = await this.state.contractFacade.attack(
                    this.state.trainingOpponent,
                    this.state.trainingSelfSelection,
                    DEFAULT_VARIANTS,
                    commander
                );

                return this.replayFightResult(result);
            } catch (error) {
                this.setState({
                    toastOpen: true,
                    toastContent: 'Transaction failed (Attack).',
                });
            }
        } else {
            const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            let result;

            try {
                result = await this.state.contractFacade.replay(
                    seed,
                    this.state.trainingSelfSelection,
                    this.state.trainingOpponentSelection,
                    DEFAULT_VARIANTS,
                    DEFAULT_VARIANTS,
                    commander,
                    this.state.trainingOpponentCommander
                );
            } catch (error) {
                return this.setState({
                    ...this.defaultLoadedState,
                    toastOpen: true,
                    toastContent: 'Transaction failed (Replay).',
                });
            }

            return this.setState({
                mode: Modes.Combat,
                trainingSelfCommander: commander,
                trainingResult: result,
            });
        }

        this.setState(this.defaultLoadedState);
    }

    /**
     * Handler for the commander preview done action.
     * Returns to the main menu.
     */
    commanderPreviewDone() {
        this.setState(this.defaultLoadedState);
    }

    /**
     * Handler for the opponent selection done action.
     * Moves to the ship selection stage.
     */
    opponentSelectionDone(opponent) {
        const trainingOpponentSelection = opponent.selection;

        this.setState({
            mode: Modes.ShipSelection,
            settingAttack: true,
            trainingOpponent: opponent.address,
            trainingOpponentSelection,
            trainingOpponentCommander: opponent.commander,
            trainingCp: this._selectionToCp(trainingOpponentSelection),
        });
    }

    /**
     * Internal function to get the CP of a fleet.
     */
    _selectionToCp(selection) {
        return _.reduce(selection, (memo, num, index) => {
            return memo + (num || 0) * Ships[index].stats.cp;
        }, 0);
    }

    /**
     * Handler for the player name change action.
     */
    handlePlayerNameChange(e) {
        window.localStorage.setItem('OmegaPlayerName', e.target.value);
        this.setState({
            playerName: e.target.value,
        });
    }

    /**
     * Handler for the training action.
     * Moves to the ship selection stage.
     */
    training() {
        const trainingOpponentSelection = TRAINING_SELECTION;

        this.setState({
            mode: Modes.ShipSelection,
            trainingOpponentSelection,
            trainingOpponentCommander: 0,
            trainingCp: this._selectionToCp(trainingOpponentSelection),
        });
    }

    /**
     * Handler for the commanders action.
     * Moves to the commander preview screen.
     */
    async commanders() {
        let commanders;

        try {
            commanders = await this.state.contractFacade.getCommanders();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get Commanders).',
            });
        }

        this.setState({
            mode: Modes.CommanderPreview,
            ownCommanders: commanders,
        });
    }

    /**
     * Handler for the register defence action.
     * Moves to the ship selection stage.
     */
    async defend() {
        this.setState({
            loading: true,
        });

        let myDefence;

        try{
            myDefence = await this.state.contractFacade.getOwnDefence();
        } catch (error) {
        }

        const trainingOpponentSelection = myDefence
            ? myDefence.selection
            : TRAINING_SELECTION;

        this.setState({
            mode: Modes.ShipSelection,
            settingDefence: true,
            trainingOpponentSelection,
            trainingCp: this._selectionToCp(trainingOpponentSelection),
            loading: false,
        });
    }

    /**
     * Closes all open toasts.
     */
    onToastClose() {
        this.setState({
            toastOpen: false,
            toastContent: '',
        });
    }

    /**
     * Replays a fight result.
     * Accepts the result and opens a Combat screen.
     */
    async replayFightResult(metaResult) {
        this.setState({
            loading: true,
        });

        let result;

        try {
            result = await this.state.contractFacade.replay(
                metaResult.seed,
                metaResult.selection_lhs,
                metaResult.selection_rhs,
                metaResult.variants_lhs,
                metaResult.variants_rhs,
                metaResult.commander_lhs,
                metaResult.commander_rhs);
        } catch (error) {
            console.log(error);
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Replay Fight).',
            });
        }

        this.setState({
            mode: Modes.Combat,
            trainingSelfSelection: result.selection_lhs,
            trainingSelfCommander: result.commander_lhs,
            trainingOpponentSelection: result.selection_rhs,
            trainingOpponentCommander: result.commander_rhs,
            trainingResult: result,
            loading: false,
        });
    }

    /**
     * Handler for the attack action.
     * Moves to the opponent selection stage.
     */
    async attack() {
        this.setState({
            loading: true,
        });

        let defenders;

        try {
            defenders = await this.state.contractFacade.getAllDefenders();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get All Defenders).',
            });
        }

        this.setState({
            mode: Modes.OpponentSelection,
            defenders,
            loading: false,
        });
    }

    /**
     * Handler for the leaderboard action.
     * Opens the leaderboard screen.
     */
    async leaderboard() {
        this.setState({
            loading: true,
        });

        let leaderboard;
        try {
            leaderboard = await this.state.contractFacade.getLeaderboard();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get Leaderboard).',
            });
        }

        this.setState({
            mode: Modes.Leaderboard,
            leaderboard,
            loading: false,
        });
    }

    /**
     * Handler for the login done action.
     * Starts the Web3 initialization process.
     */
    onLoginDone(options) {
        this.setState({
            loading: true,
        }, () => {
            _.defer(() => {
                const mnemonic = options.finisher();
                this._initWeb3(mnemonic);
            });
        });
    }

    /**
     * Handler for the show settings action.
     * Opens the settings screen.
     */
    showSettings() {
        this.setState({
            mode: Modes.Settings,
        });
    }

    async buyLootCrate() {
        this.setState({
            loading: true,
        });

        try {
            await this.state.contractFacade.buyLootCrate();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Buy Loot Create).',
            });
        }

        return this.commanders();
    }

    /**
     * Generic cancel handler.
     * Returns to Main Menu.
     */
    genericCancelHandler() {
        this.setState(this.defaultLoadedState);
    }

    /**
     * Handler for the intro video playback complete.
     * Opens the login screen.
     */
    introVideoComplete() {
        this.setState({
            mode: Modes.LoginScreen,
        });
    }

    /**
     * Main renderer.
     */
    render() {
        const ethBalanceString = this._formatBalance(this.state.ethBalance);

        return (
            <div className="App">
                {this.state.mode === Modes.LoginScreen &&
                    <LoginScreen onDone={this.onLoginDone.bind(this)}/>
                }
                {this.state.mode === Modes.MainScreen &&
                    <div className="mainScreen ui">
                        <div className="mainTitle">
                        </div>
                        <div className="playerName">
                            <input autoCorrect="off" type="text" className="playerNameInput" value={this.state.playerName}
                                onChange={this.handlePlayerNameChange.bind(this)}/>
                        </div>
                        <div className="lootCrate" onClick={this.buyLootCrate.bind(this)}>
                            <AttachMoneyIcon fontSize="large"/>
                        </div>
                        <div className="settings" onClick={this.showSettings.bind(this)}>
                            <SettingsIcon fontSize="large"/>
                        </div>
                        <div className="mainMenu">
                            <div className="mainMenuItem" onClick={this.training.bind(this)}>
                                TRAINING
                            </div>
                            <div className="mainMenuItem" onClick={this.commanders.bind(this)}>
                                ACADEMY
                            </div>
                            <div className="mainMenuItem" onClick={this.defend.bind(this)}>
                                DEFENCE
                            </div>
                            <div className="mainMenuItem" onClick={this.attack.bind(this)}>
                                ATTACK
                            </div>
                            <div className="mainMenuItem" onClick={this.leaderboard.bind(this)}>
                                RANKING
                            </div>
                        </div>
                        <div className="versionBox uiElement bottomElement">
                            {OmegaDefaults.VERSION_STRING}
                        </div>
                        <div className="ethBalance uiElement bottomElement">
                            Balance: {ethBalanceString} | Network: {OmegaDefaults.NETWORK}
                        </div>
                    </div>
                }
                {this.state.mode === Modes.Settings &&
                    <Settings onDone={() => { this.setState(this.defaultLoadedState) }}
                        address={this.state.contractFacade.alice.address} balance={ethBalanceString}
                        mnemonic={this.state.contractFacade.alice.mnemonic}
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                {this.state.mode === Modes.ShipSelection &&
                    <ShipSelection maxCp={this.state.trainingCp}
                        defaultShips={this.state.trainingOpponentSelection}
                        onDone={this.shipSelectionDone.bind(this)}
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                {this.state.mode === Modes.CommanderSelection &&
                    <CommanderSelection onDone={this.commanderSelectionDone.bind(this)}
                        commanders={this.state.ownCommanders}
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                {this.state.mode === Modes.CommanderPreview &&
                    <CommanderSelection onDone={this.commanderPreviewDone.bind(this)}
                        commanders={this.state.ownCommanders}
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                {this.state.mode === Modes.Combat &&
                    <Combat selectionLhs={this.state.trainingSelfSelection}
                        selectionRhs={this.state.trainingOpponentSelection}
                        commanderLhs={this.state.trainingSelfCommander}
                        commanderRhs={0}
                        result={this.state.trainingResult}
                        onCancel={this.genericCancelHandler.bind(this)}
                    />
                }
                {this.state.mode === Modes.OpponentSelection &&
                    <OpponentSelection opponents={this.state.defenders}
                        onDone={this.opponentSelectionDone.bind(this)}
                        onCancel={this.genericCancelHandler.bind(this)}
                    />
                }
                {this.state.mode === Modes.Leaderboard &&
                    <Leaderboard leaderboard={this.state.leaderboard}
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                <div
                    id="omegaLoadingScreen"
                    style={!this.state.loading ? {display: 'none'} : {}}>
                    <div className="logo"/>
                    <div className="progressOuter progress-line"/>
                    <div className="status">
                        <span className="blockchain">
                            Waiting for blockchain...
                        </span>
                        <span className="assets">
                            Loading assets...
                        </span>
                    </div>
                </div>
                {this.state.mode === Modes.PlayingVideo &&
                    <div className="introVideo">
                        <video width="100%"
                            height="100%"
                            autoPlay={true}
                            muted={true}
                            onEnded={this.introVideoComplete.bind(this)}
                            poster="noposter">
                            <source src="assets/videos/intro.mp4" type="video/mp4"/>
                        </video>
                    </div>
                }
                <Snackbar
                    open={this.state.toastOpen}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    autoHideDuration={6000}
                    onClose={this.onToastClose.bind(this)}
                    message={this.state.toastContent}
                />
            </div>
        );
    }

    /**
     * Formats a DOT balance.
     */
    _formatBalance(balance) {
        return parseFloat(balance, 10).toFixed(0).toString();
    }

    /**
     * Initializes Web3 environment from a mnemonic.
     * Moves to the main screen stage.
     */
    async _initWeb3(mnemonic) {
        this.setState({
            loading: true,
        });

        const facade = new ContractFacade();
        await facade.initialize(mnemonic);
        await this._checkBalance(facade);

        this.setState({
            contractFacade: facade,
            mode: Modes.MainScreen,
            loading: false,
        });
    }

    /**
     * Checks balance for current account.
     */
    async _checkBalance(facade) {
        // eslint-disable-next-line no-unused-vars
        const { _nonce, data: balance } = await facade.api.query.system.account(facade.alice.address);

        this.setState({
            ethBalance: balance.free,
        });
    }
}

