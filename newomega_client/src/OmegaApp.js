import './App.css';
import React, { Component } from 'react';
import { ethers } from 'ethers';
import { ShipSelection } from './scenes/ShipSelection';
import { CommanderSelection } from './scenes/CommanderSelection';
import { Combat } from './scenes/Combat';
import { OpponentSelection } from './ui/OpponentSelection';
import { Leaderboard } from './ui/Leaderboard';
import { LoginScreen } from './ui/LoginScreen';
import { ShowLogs } from './ui/ShowLogs';
import { Settings } from './ui/Settings';
import { Ships } from './definitions/Ships';
import { FastJsonRpcProvider } from './common/FastProvider';
import Snackbar from '@material-ui/core/Snackbar';
import SettingsIcon from '@material-ui/icons/Settings';
import _ from 'underscore';



const Modes = {
    PlayingVideo: 0,
    LoginScreen: 1,
    MainScreen: 2,
    ShipSelection: 3,
    CommanderSelection: 4,
    CommanderPreview: 5,
    Combat: 6,
    OpponentSelection: 7,
    ShowLogs: 8,
    Leaderboard: 9,
    Settings: 10,
};

const TRAINING_SELECTION = [35, 25, 15, 10];
const DEFAULT_INFURA_PROVIDER = 'ropsten';
const DEFAULT_ELAETH_PROVIDER = 'http://api.elastos.io:21636';
const DEFAULT_MATIC_PROVIDER = 'https://rpc-mumbai.matic.today';
const INFURA_KEY = 'dbb5964e1c98437389d0c43ee39db58a';
const CONTRACT_ADDRESS = '0xf6D65Ade19ec1a4F76410622689d1f21dc3D8ea5';


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
            settingDefence: false,
            settingAttack: false,
        };

        this.defaultUnloadedState = {
            mode: Modes.PlayingVideo,
            ownAccount: null,
            ethBalance: 0,
            ethPrice: 0.0,
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

    shipSelectionDone(selection) {
        this.setState({
            mode: Modes.CommanderSelection,
            trainingSelfSelection: selection,
        });
    }

    componentDidMount() {
        fetch(`https://data.messari.io/api/v1/assets/matic/metrics`)
            .then((response) => response.json())
            .then((data) => {
                try {
                    const ethPrice = parseFloat(_.property(['data', 'market_data', 'price_usd'])(data));
                    this.setState({
                        ethPrice,
                    });
                } catch (error) {
                }
            });
    }

    async commanderSelectionDone(commander) {
        this.setState({
            loading: true,
        });

        if (this.state.settingDefence) {
            try {
                const tx = await this.state.newOmegaContract.registerDefence(
                    this.state.trainingSelfSelection,
                    commander,
                    ethers.utils.formatBytes32String(this.state.playerName)
                );

                await tx.wait();
            } catch (error) {
                this.setState({
                    toastOpen: true,
                    toastContent: 'Transaction failed (Defence).',
                });
            }
        } else if (this.state.settingAttack) {
            try {
                const tx = await this.state.newOmegaContract.attack(
                    this.state.trainingOpponent,
                    this.state.trainingSelfSelection,
                    commander
                );

                await tx.wait();
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
                result = await this.state.newOmegaContract.replay(
                    seed,
                    this.state.trainingSelfSelection,
                    this.state.trainingOpponentSelection,
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

    commanderPreviewDone() {
        this.setState(this.defaultLoadedState);
    }

    opponentSelectionDone(opponent) {
        const trainingOpponentSelection = opponent.defenceSelection;

        this.setState({
            mode: Modes.ShipSelection,
            settingAttack: true,
            trainingOpponent: opponent.player,
            trainingOpponentSelection,
            trainingOpponentCommander: opponent.commander,
            trainingCp: this._selectionToCp(trainingOpponentSelection),
        });
    }

    _selectionToCp(selection) {
        return _.reduce(selection, (memo, num, index) => {
            return memo + (num || 0) * Ships[index].stats.cp;
        }, 0);
    }

    handlePlayerNameChange(e) {
        window.localStorage.setItem('OmegaPlayerName', e.target.value);
        this.setState({
            playerName: e.target.value,
        });
    }

    training() {
        const trainingOpponentSelection = TRAINING_SELECTION;

        this.setState({
            mode: Modes.ShipSelection,
            trainingOpponentSelection,
            trainingOpponentCommander: 0,
            trainingCp: this._selectionToCp(trainingOpponentSelection),
        });
    }

    commanders() {
        this.setState({
            mode: Modes.CommanderPreview,
        });
    }

    async defend() {
        this.setState({
            loading: true,
        });

        let myDefence;

        try{
            myDefence = await this.state.newOmegaContract.getOwnDefence();
        } catch (error) {
        }

        const trainingOpponentSelection = myDefence && myDefence.isInitialised
            ? myDefence.defenceSelection
            : TRAINING_SELECTION;

        this.setState({
            mode: Modes.ShipSelection,
            settingDefence: true,
            trainingOpponentSelection,
            trainingCp: this._selectionToCp(trainingOpponentSelection),
            loading: false,
        });
    }

    estimateUsdCost(gas) {
        const oneGwei = 0.000000001;
        return (gas * oneGwei * this.state.ethPrice).toFixed(6);
    }

    etherToUsd(eth) {
        try {
            const ethFloat = parseFloat(eth);
            return (ethFloat * this.state.ethPrice).toFixed(6);
        } catch (error) {
            return 0;
        }
    }

    attachBlockchainEvents(provider, newOmegaContract, ownAccount) {
        const filter = newOmegaContract.filters.FightComplete();
        filter.attacker = ownAccount;

        provider.on(filter, () => {
            this.setState({
                hasUnseenFights: true,
            });
        });

        provider._newOmegaGasEstimated = (gas) => {
            this.setState({
                toastOpen: true,
                toastContent: `Estimated gas: ${gas} ($${this.estimateUsdCost(gas)})`,
            });
        };

        provider.on('block', (blockNumber) => {
            this._checkBalance(provider, ownAccount);
            this.setState({
                blockNumber,
            });
        });
    }

    onToastClose() {
        this.setState({
            toastOpen: false,
            toastContent: '',
        });
    }

    async showLogs() {
        const filterAttacker = this.state.newOmegaContract.filters.FightComplete();
        filterAttacker.fromBlock = this.state.provider.getBlockNumber().then((b) => b - 100000);
        filterAttacker.toBlock = 'latest';
        filterAttacker.attacker = this.state.ownAccount;

        const filterDefender = this.state.newOmegaContract.filters.FightComplete();
        filterAttacker.fromBlock = this.state.provider.getBlockNumber().then((b) => b - 100000);
        filterAttacker.toBlock = 'latest';
        filterAttacker.defender = this.state.ownAccount;

        this.setState({
            loading: true,
        });

        let logsAttacker, logsDefender;

        try {
            logsAttacker = await this.state.provider.getLogs(filterAttacker);
            logsDefender = await this.state.provider.getLogs(filterDefender);
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get Logs).',
            });
        }

        const logs = logsAttacker.concat(logsDefender);
        const logsParsed = _.map(logs, (log) => {
            return this.state.newOmegaContract.interface.parseLog(log);
        });

        let defenders;

        try {
            defenders = await this.state.newOmegaContract.getAllDefenders();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get All Defenders).',
            });
        }

        this.setState({
            mode: Modes.ShowLogs,
            logs: logsParsed,
            loading: false,
            hasUnseenFights: false,
            defenders,
        });
    }

    async logSelectionDone(log) {
        const metaResult = log.args[2];

        this.setState({
            loading: true,
        });

        let result;

        try {
            result = await this.state.newOmegaContract.replay(
                metaResult.seed,
                metaResult.selectionLhs,
                metaResult.selectionRhs,
                metaResult.commanderLhs,
                metaResult.commanderRhs);
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Replay Fight).',
            });
        }

        const _parseHp = (hp) => {
            return _.map(hp, (hpInst) => {
                return hpInst.toNumber();
            });
        }

        const resultJson = {
            lhs: result.lhs,
            rhs: result.rhs,
            lhsHp: _parseHp(result.lhsHp),
            rhsHp: _parseHp(result.rhsHp),
            rounds: result.rounds,
            selectionLhs: result.selectionLhs,
            selectionRhs: result.selectionRhs,
            commanderLhs: result.commanderLhs,
            commanderRhs: result.commanderRhs,
            lhsDead: result.lhsDead,
            rhsDead: result.rhsDead,
        };

        this.setState({
            mode: Modes.Combat,
            trainingSelfSelection: resultJson.selectionLhs,
            trainingSelfCommander: resultJson.commanderLhs,
            trainingOpponentSelection: resultJson.selectionRhs,
            trainingResult: resultJson,
            loading: false,
        });
    }

    async attack() {
        this.setState({
            loading: true,
        });

        let defenders;

        try {
            defenders = await this.state.newOmegaContract.getAllDefenders();
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

    async leaderboard() {
        const filterAllLogs = this.state.newOmegaContract.filters.FightComplete();
        filterAllLogs.fromBlock = this.state.provider.getBlockNumber().then((b) => b - 100000);
        filterAllLogs.toBlock = 'latest';

        this.setState({
            loading: true,
        });

        let logs;

        try {
            logs = await this.state.provider.getLogs(filterAllLogs);
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get Leaderboard).',
            });
        }

        const logsParsed = _.map(logs, (log) => {
            return this.state.newOmegaContract.interface.parseLog(log);
        });

        let defenders;

        try {
            defenders = await this.state.newOmegaContract.getAllDefenders();
        } catch (error) {
            return this.setState({
                ...this.defaultLoadedState,
                toastOpen: true,
                toastContent: 'Transaction failed (Get All Defenders).',
            });
        }

        this.setState({
            mode: Modes.Leaderboard,
            logs: logsParsed,
            defenders,
            loading: false,
        });
    }

    onLoginDone(options) {
        this.setState({
            loading: true,
        }, () => {
            _.defer(() => {
                const provider = new FastJsonRpcProvider(DEFAULT_MATIC_PROVIDER);
                const signer = options.finisher().connect(provider);
                this._initWeb3(provider, signer);
            });
        });
    }

    showSettings() {
        this.setState({
            mode: Modes.Settings,
        });
    }

    genericCancelHandler() {
        this.setState(this.defaultLoadedState);
    }

    introVideoComplete() {
        this.setState({
            mode: Modes.LoginScreen,
        });
    }

    render() {
        const logsClassName = `mainMenuItem ${this.state.hasUnseenFights ? 'unread' : ''}`;
        const ethBalanceString = this._formatBalance(ethers.utils.formatEther(this.state.ethBalance));

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
                            <div className={logsClassName} onClick={this.showLogs.bind(this)}>
                                LOGS
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
                            Version: 0.0.1 (c) celrisen.eth
                        </div>
                        <div className="ethBalance uiElement bottomElement">
                            MATIC: {ethBalanceString} (${this.etherToUsd(ethBalanceString)}) | Network: Matic Ethereum (Testnet) | Block: {this.state.blockNumber}
                        </div>
                    </div>
                }
                {this.state.mode === Modes.Settings &&
                    <Settings onDone={() => { this.setState(this.defaultLoadedState) }}
                        address={this.state.ownAccount} balance={ethBalanceString}
                        mnemonic={this.state.signer && this.state.signer.mnemonic.phrase}
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
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                {this.state.mode === Modes.CommanderPreview &&
                    <CommanderSelection onDone={this.commanderPreviewDone.bind(this)}
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
                {this.state.mode === Modes.ShowLogs &&
                    <ShowLogs logs={this.state.logs}
                        opponents={this.state.defenders}
                        onDone={this.logSelectionDone.bind(this)}
                        onCancel={this.genericCancelHandler.bind(this)}/>
                }
                {this.state.mode === Modes.Leaderboard &&
                    <Leaderboard logs={this.state.logs}
                        defenders={this.state.defenders}
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

    _formatBalance(balance) {
        return parseFloat(balance, 10).toFixed(4).toString();
    }

    async _initWeb3(provider, signer) {
        // const provider = new TrinitySDK.Ethereum.Web3.Providers.TrinityWeb3Provider();
        // provider = provider || new FastProvider(window.ethereum);
        // signer = signer || provider.getSigner();

        this.setState({
            loading: true,
        });

        let ownAccount;
        if (!provider) {
            const accounts = await window.ethereum.send('eth_requestAccounts');
            ownAccount = accounts.result[0];
        } else {
            ownAccount = signer.address;
        }

        await this._checkBalance(provider, ownAccount);
        this.setState({
            provider,
            ownAccount,
            signer,
        }, () => {
            this._loadContracts(provider, signer, ownAccount);
        });
    }

    async _checkBalance(provider, ownAccount) {
        const ethBalance = await provider.getBalance(ownAccount);
        this.setState({
            ethBalance,
        });
    }

    _loadContracts(provider, signer, ownAccount) {
        const newOmegaJson = require('./abi/NewOmega.json');
        const newOmegaContract = new ethers.Contract(CONTRACT_ADDRESS, newOmegaJson, signer);

        this.attachBlockchainEvents(provider, newOmegaContract, ownAccount);
        this.setState({
            newOmegaContract,
            mode: Modes.MainScreen,
            loading: false,
        });
    }
}

