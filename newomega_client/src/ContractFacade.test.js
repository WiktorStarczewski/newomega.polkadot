import _ from 'underscore';


const BLOCK_LENGTH = 8000;

const { ContractFacade } = require('./facades/ContractFacade');


jest.setTimeout(50000);

let delegatorAddress;

const { Deployer } = require('./facades/Deployer');
test('Deploy', async () => {
    const deployer = new Deployer();
    await deployer.initialize();

    return deployer.deployDelegator().then((contract) => {
        console.log('Delegator address ', contract.address.toHuman());
        delegatorAddress = contract.address.toHuman();
        expect(contract).toBeDefined();
    });
});

test('Initialize', async () => {
    const facade = new ContractFacade();
    await facade.initialize('//Alice', delegatorAddress);

    expect(facade.api).toBeDefined();
    expect(facade.keyring).toBeDefined();
    expect(facade.alice).toBeDefined();
    expect(facade.contracts).toBeDefined();
});

test('RegisterDefence', async () => {
    // Alice
    const facadeAlice = new ContractFacade();
    await facadeAlice.initialize('//Alice', delegatorAddress);

    const selection = [10, 27, 43, 15];
    const variants = [0, 1, 0, 1];
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
    await facadeBob.initialize('//Bob', delegatorAddress);

    const selectionBob = [23, 9, 9, 5];
    const variantsBob = [1, 0, 1, 1];
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
    await facadeAlice.initialize('//Alice', delegatorAddress);

    const facadeBob = new ContractFacade();
    await facadeBob.initialize('//Bob', delegatorAddress);

    const leaderboardPre = await facadeAlice.getLeaderboard();
    const alicePre = _.findWhere(leaderboardPre, {
        address: facadeAlice.alice.address,
    });
    const bobPre = _.findWhere(leaderboardPre, {
        address: facadeBob.alice.address,
    });
    const alicePreBoard = alicePre || { ranked_wins: 0, ranked_losses: 0 };
    const bobPreBoard = bobPre || { ranked_wins: 0, ranked_losses: 0 };

    const selection = [1, 0, 0, 0];
    const variants = [1, 0, 1, 1];
    const commander = 0;

    const attackResult = await facadeAlice.attack(facadeBob.alice.address, selection, variants, commander);
    expect(attackResult.seed).toBeDefined();
    expect(attackResult.lhs_dead).toBeTruthy();

    await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

    const leaderboardPost = await facadeAlice.getLeaderboard();
    const alicePost = _.findWhere(leaderboardPost, {
        address: facadeAlice.alice.address,
    });
    const bobPost = _.find(leaderboardPost, {
        address: facadeBob.alice.address,
    });

    const alicePostBoard = alicePost || { ranked_wins: 0, ranked_losses: 0 };
    const bobPostBoard = bobPost || { ranked_wins: 0, ranked_losses: 0 };

    expect(alicePostBoard.ranked_wins).toEqual(alicePreBoard.ranked_wins);
    expect(alicePostBoard.ranked_losses).toEqual(alicePreBoard.ranked_losses + 1);

    expect(bobPostBoard.ranked_wins).toEqual(bobPreBoard.ranked_wins + 1);
    expect(bobPostBoard.ranked_losses).toEqual(bobPreBoard.ranked_losses);
});

test('Replay', async () => {
    const facade = new ContractFacade();
    await facade.initialize('//Alice', delegatorAddress);

    const seed = 1337;
    const selectionLhs = [3, 3, 3, 3];
    const selectionRhs = [16, 16, 16, 16];
    const variantsLhs = [0, 1, 0, 1];
    const variantsRhs = [1, 0, 1, 0];
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
