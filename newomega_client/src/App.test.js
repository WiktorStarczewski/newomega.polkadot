import { render, screen } from '@testing-library/react';
import App from './App';

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
    await facade.initialize(MNEMONIC);

    expect(facade.api).toBeDefined();
    expect(facade.keyring).toBeDefined();
    expect(facade.alice).toBeDefined();
    expect(facade.contracts).toBeDefined();
});

test('RegisterDefence', async () => {
    const facade = new ContractFacade();
    await facade.initialize(MNEMONIC);

    const selection = Uint8Array.from([10, 27, 43, 15]);
    const variants = Uint8Array.from([0, 1, 0, 1]);
    const commander = 0;
    const name = 'TestAlice';
    await facade.registerDefence(selection, variants, commander, name).catch(console.log);
    await new Promise((r) => setTimeout(r, BLOCK_LENGTH));

    const defence = await facade.getOwnDefence();

    expect(defence.selection).toEqual(selection);
    expect(defence.variants).toEqual(variants);
    expect(defence.commander).toEqual(commander);
    expect(defence.name).toEqual(name);
});
