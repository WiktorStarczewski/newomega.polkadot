import './LoginScreen.css';
import React from 'react';
import _ from 'underscore';
import { mnemonicGenerate } from '@polkadot/util-crypto';
import { OmegaDefaults } from '../definitions/OmegaDefaults';


export class LoginScreen extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            enteringMnemonic: false,
            mnemonic: '',
        };
    }

    /**
     * Handler for the sign up action.
     * Generates a mnemonic and stores it in local storage.
     */
    signUp() {
        this.props.onDone({
            finisher: () => {
                const mnemonic = mnemonicGenerate();
                localStorage.setItem('OmegaMnemonic', mnemonic);
                return mnemonic;
            },
        });
    }

    /**
     * Performs a login from mnemonic.
     */
    logInFromMnemonic() {
        this.logIn(this.state.mnemonic);
    }

    /**
     * Finishes the login flow, returning the mnemonic.
     */
    logIn(mnemonic) {
        this.props.onDone({
            finisher: () => {
                return mnemonic;
            },
        });
    }

    componentDidMount() {
        const mnemonic = localStorage.getItem('OmegaMnemonic');

        if (!_.isEmpty(mnemonic)) {
            this.logIn(mnemonic);
        }
    }

    /**
     * Handler for the mnemonic input changed.
     */
    mnemonicInputChanged(e) {
        this.setState({
            mnemonic: e.target.value,
        });
    }

    /**
     * Enters the visual state of putting in the mnemonic.
     */
    startMnemonicInput() {
        this.setState({
            enteringMnemonic: true,
        });
    }

    render() {
        return (
            <div className="LoginScreen">
                <div className="ui">
                    <div className="mainTitle">
                    </div>
                    {this.state.enteringMnemonic &&
                        <div className="loginDetails">
                            <textarea className="mnemonicInput"
                                onChange={this.mnemonicInputChanged.bind(this)}
                                value={this.state.mnemonic}
                                placeholder="Enter your 12-word mnemonic for the Matic Ethereum Testnet network"/>
                        </div>
                    }
                    {!this.state.enteringMnemonic &&
                        <div className="mainMenu">
                            <div className="mainMenuItem" onClick={this.signUp.bind(this)}>
                                SIGN UP
                            </div>
                            <div className="mainMenuItem" onClick={this.startMnemonicInput.bind(this)}>
                                LOG IN
                            </div>
                        </div>
                    }
                    {this.state.enteringMnemonic &&
                        <div className="uiElement doneBox bottomBox"
                            onClick={this.logInFromMnemonic.bind(this)}>
                            LOG IN
                        </div>
                    }
                    <div className="versionBox uiElement bottomElement">
                        {OmegaDefaults.VERSION_STRING}
                    </div>
                </div>
            </div>
        );
    }
};
