import './Settings.css';
import React, { useState } from 'react';
import { OmegaDefaults } from '../definitions/OmegaDefaults';
import Snackbar from '@material-ui/core/Snackbar';
import QRCode from 'react-qr-code';


export const Settings = (props) => {
    const [toastOpen, setToastOpen] = useState(false);

    /**
     * Copies the address to clipboard.
     */
    const copyAddressToClipboard = () => {
        navigator.clipboard.writeText(props.address).then(() => {
            setToastOpen(true);
        });
    }

    /**
     * Handler for closing toasts.
     */
    const onToastClose = () => {
        setToastOpen(false);
    }

    const qrCodeValue = `${props.address}`;

    return (
        <div className="Settings">
            <div className="ui">
                <div className="mainTitle">
                </div>
                <div className="mainMenu">
                    <div className="qr">
                        <QRCode value={qrCodeValue} size={128}/>
                    </div>
                    <div className="info" onClick={copyAddressToClipboard}>
                        <div className="network">
                            Network: {OmegaDefaults.NETWORK}
                        </div>
                        <div className="address">
                            Address: <span className="guid">{props.address}</span>
                        </div>
                        <div className="balance">
                            Balance: {props.balance}
                        </div>
                        <div className="mnemonic">
                            Mnemonic: <span className="mnemonic-content">{localStorage.getItem('OmegaMnemonic')}</span>
                        </div>
                    </div>
                </div>
                <div className="uiElement doneBox bottomBox" onClick={props.onCancel}>
                    BACK
                </div>
            </div>
            <Snackbar
                open={toastOpen}
                autoHideDuration={3000}
                onClose={onToastClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                message="Address copied to clipboard."
            />
        </div>
    );
};
