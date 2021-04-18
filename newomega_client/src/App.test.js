import { render, screen, fireEvent } from '@testing-library/react';
import { Leaderboard } from './ui/Leaderboard';
import { OpponentSelection } from './ui/OpponentSelection';
import { LoginScreen } from './ui/LoginScreen';
import { Settings } from './ui/Settings';


jest.setTimeout(25000);

test('Leaderboard', async () => {
    const leaderboard = [
        {
            address: 'Address 1',
            ranked_wins: 10,
            ranked_losses: 0,
        },
        {
            address: 'Address 2',
            ranked_wins: 5,
            ranked_losses: 10,
        },
    ];

    render(<Leaderboard leaderboard={leaderboard}/>);

    const firstAddress = screen.getByText(/address 1/i);
    expect(firstAddress).toBeInTheDocument();

    const secondAddress = screen.getByText(/address 2/i);
    expect(secondAddress).toBeInTheDocument();

    const mainMenuItems = screen.getAllByText(/address/i);
    expect (mainMenuItems.length).toBe(2);
});

test('LoginScreen - Signup', async () => {
    const onLoginDone = (options) => {
        const mnemonic = options.finisher();
        expect(mnemonic).toBeDefined();
        const words = mnemonic.split(' ');
        expect(words.length).toBe(12);
        expect(mnemonic).toEqual(localStorage.getItem('OmegaMnemonic'));
    };

    render(<LoginScreen onDone={onLoginDone}/>);

    const signupButton = screen.getByText(/sign up/i);
    expect(signupButton).toBeInTheDocument();

    signupButton.click();
    await new Promise((r) => setTimeout(r, 1000));
});

test('LoginScreen - Login', async () => {
    localStorage.removeItem('OmegaMnemonic');

    const dummyMnemonic = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';

    const onLoginDone = (options) => {
        const mnemonic = options.finisher();
        expect(mnemonic).toEqual(dummyMnemonic);
    };

    render(<LoginScreen onDone={onLoginDone}/>);

    const loginButton = screen.getByText(/log in/i);
    expect(loginButton).toBeInTheDocument();

    loginButton.click();

    const mnemonicInput = screen.getByPlaceholderText(/mnemonic/i);
    fireEvent.change(mnemonicInput, { target: { value: dummyMnemonic }});

    const loginAfterEntryButton = screen.getByText(/log in/i);
    expect(loginAfterEntryButton).toBeInTheDocument();

    loginAfterEntryButton.click();

    await new Promise((r) => setTimeout(r, 1000));
});

test('OpponentSelection', async () => {
    const opponents = [
        {
            name: 'Player 1',
        },
        {
            name: 'Player 2',
        },
    ];

    const onSelectionDone = (opponent) => {
        expect(opponent).toBeDefined();
        expect(opponent.name).toEqual(opponents[0].name);
    };

    render(<OpponentSelection opponents={opponents} onDone={onSelectionDone} />);

    const firstAddress = screen.getByText(/player 1/i);
    expect(firstAddress).toBeInTheDocument();

    const secondAddress = screen.getByText(/player 2/i);
    expect(secondAddress).toBeInTheDocument();

    const mainMenuItems = screen.getAllByText(/player/i);
    expect (mainMenuItems.length).toBe(2);

    firstAddress.click();

    await new Promise((r) => setTimeout(r, 1000));
});

test('Settings', async () => {
    const address = 'Dummy Address';
    const balance = 1337;

    render(<Settings address={address} balance={balance} />);

    const firstAddress = screen.getByText(/dummy address/i);
    expect(firstAddress).toBeInTheDocument();

    const balanceElement = screen.getByText(/1337/i);
    expect(balanceElement).toBeInTheDocument();
});
