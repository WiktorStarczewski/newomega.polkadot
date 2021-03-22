import { render, screen } from '@testing-library/react';
import App from './App';
import _ from 'underscore';


// test('renders learn react link', () => {
//   render(<App />);
//   const linkElement = screen.getByText(/learn react/i);
//   expect(linkElement).toBeInTheDocument();
// });


const BLOCK_LENGTH = 6000;

const MNEMONIC = '';
const { ContractFacade } = require('./facades/ContractFacade');
const { Deployer } = require('./facades/Deployer');


jest.setTimeout(50000);

// test('Deploy', async () => {
//     const deployer = new Deployer();
//     await deployer.initialize();

//     return deployer.deployDelegator().then((contract) => {
//         expect(contract).toBeDefined();
//     });
// });

test('Initialize', async () => {
    const facade = new ContractFacade();
    await facade.initialize('//Alice');

    expect(facade.api).toBeDefined();
    expect(facade.keyring).toBeDefined();
    expect(facade.alice).toBeDefined();
    expect(facade.contracts).toBeDefined();
});

test('RegisterDefence', async () => {
    // Alice
    const facadeAlice = new ContractFacade();
    await facadeAlice.initialize('//Alice');

    const selection = Uint8Array.from([10, 27, 43, 15]);
    const variants = Uint8Array.from([0, 1, 0, 1]);
    const commander = 0;
    const name = 'TestAlice';
    await facadeAlice.registerDefence(selection, variants, commander, name);
    await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

    const defence = await facadeAlice.getOwnDefence();

    expect(defence.selection).toEqual(selection);
    expect(defence.variants).toEqual(variants);
    expect(defence.commander).toEqual(commander);
    expect(defence.name).toEqual(name);

    // Bob
    const facadeBob = new ContractFacade();
    await facadeBob.initialize('//Bob');

    const selectionBob = Uint8Array.from([23, 9, 9, 5]);
    const variantsBob = Uint8Array.from([1, 0, 1, 1]);
    const commanderBob = 0;
    const nameBob = 'TestBob';
    await facadeBob.registerDefence(selectionBob, variantsBob, commanderBob, nameBob);
    await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

    const defenceBob = await facadeBob.getOwnDefence();

    expect(defenceBob.selection).toEqual(selectionBob);
    expect(defenceBob.variants).toEqual(variantsBob);
    expect(defenceBob.commander).toEqual(commanderBob);
    expect(defenceBob.name).toEqual(nameBob);

    const defenders = await facadeAlice.getAllDefenders();

    expect(defenders.length >= 2).toBeTruthy();
});

test('Attack', async () => {
    const facadeAlice = new ContractFacade();
    await facadeAlice.initialize('//Alice');

    const facadeBob = new ContractFacade();
    await facadeBob.initialize('//Bob');

    const leaderboardPre = await facadeAlice.getLeaderboard();
    const alicePre = _.find(leaderboardPre, (iter) => {
        return iter[0] === facadeAlice.alice.address;
    });
    const bobPre = _.find(leaderboardPre, (iter) => {
        return iter[0] === facadeBob.alice.address;
    });
    const alicePreBoard = alicePre
        ? alicePre[1]
        : { ranked_wins: 0, ranked_losses: 0 };
    const bobPreBoard = bobPre
        ? bobPre[1]
        : { ranked_wins: 0, ranked_losses: 0 };

    const selection = Uint8Array.from([1, 0, 0, 0]);
    const variants = Uint8Array.from([1, 0, 1, 1]);
    const commander = 0;

    await facadeAlice.attack(facadeBob.alice.address, selection, variants, commander);
    await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

    const leaderboardPost = await facadeAlice.getLeaderboard();
    const alicePost = _.find(leaderboardPost, (iter) => {
        return iter[0] === facadeAlice.alice.address;
    });
    const bobPost = _.find(leaderboardPost, (iter) => {
        return iter[0] === facadeBob.alice.address;
    });
    const alicePostBoard = alicePost
        ? alicePost[1]
        : { ranked_wins: 0, ranked_losses: 0 };
    const bobPostBoard = bobPost
        ? bobPost[1]
        : { ranked_wins: 0, ranked_losses: 0 };

    expect(alicePreBoard.ranked_wins).toEqual(alicePostBoard.ranked_wins);
    expect(alicePreBoard.ranked_losses).toEqual(alicePostBoard.ranked_losses - 1);

    expect(bobPreBoard.ranked_wins).toEqual(bobPostBoard.ranked_wins - 1);
    expect(bobPreBoard.ranked_losses).toEqual(bobPostBoard.ranked_losses);
});

test('Replay', async () => {
    const facade = new ContractFacade();
    await facade.initialize('//Alice');

    const seed = 1337;
    const selectionLhs = Uint8Array.from([3, 3, 3, 3]);
    const selectionRhs = Uint8Array.from([16, 16, 16, 16]);
    const variantsLhs = Uint8Array.from([0, 1, 0, 1]);
    const variantsRhs = Uint8Array.from([1, 0, 1, 0]);
    const commanderLhs = 0;
    const commanderRhs = 0;

    const result = await facade.replay(
        seed,
        selectionLhs,
        selectionRhs,
        variantsLhs,
        variantsRhs,
        commanderLhs,
        commanderRhs
    );

    expect(result.lhs_dead).toBeTruthy();
    expect(result.rhs_dead).toBeFalsy();
});
