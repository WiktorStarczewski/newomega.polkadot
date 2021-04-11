import './OpponentSelection.css';
import React from 'react';
import _ from 'underscore';


export const OpponentSelection = (props) => {
    /**
     * Handler for selecting the opponent.
     * Fires a onDone callback passed in via props.
     */
    const selectOpponent = (opponent) => {
        props.onDone(opponent);
    };

    /**
     * Renders one row of opponent information.
     */
    const renderOpponent = (opponent, ind) => {
        return (
            <div
                key={ind}
                className="mainMenuItem"
                onClick={() => { selectOpponent(opponent) }}
            >
                {opponent.name}
            </div>
        );
    };

    const opponents = _.clone(props.opponents).reverse();

    return (
        <div className="OpponentSelection">
            <div className="ui">
                <div className="mainTitle">
                </div>
                <div className="mainMenu">
                    {_.map(opponents, renderOpponent)}
                </div>
                <div className="uiElement cancelBox bottomBox" onClick={props.onCancel}>
                    BACK
                </div>
            </div>
        </div>
    );
};
