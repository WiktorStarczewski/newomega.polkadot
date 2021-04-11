import './Leaderboard.css';
import React from 'react';
import _ from 'underscore';


export const Leaderboard = (props) => {
    /**
     * Renders a leaderboard entry.
     */
    const renderEntry = (entry, ind) => {
        return (
            <div
                key={ind}
                className="mainMenuItem"
            >
                <div className="address">Address: {entry.address}</div>
                <div className="wins">Wins: {entry.ranked_wins}</div>
                <div className="losses">Losses: {entry.ranked_losses}</div>
            </div>
        );
    };

    return (
        <div className="Leaderboard">
            <div className="ui">
                <div className="mainTitle">
                </div>
                <div className="mainMenu">
                    {_.map(props.leaderboard, renderEntry)}
                </div>
                <div className="uiElement cancelBox bottomBox" onClick={props.onCancel}>
                    BACK
                </div>
            </div>
        </div>
    );
};
