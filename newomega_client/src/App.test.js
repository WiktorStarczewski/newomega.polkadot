import { render, screen } from '@testing-library/react';
import App from './App';

// test('renders learn react link', () => {
//   render(<App />);
//   const linkElement = screen.getByText(/learn react/i);
//   expect(linkElement).toBeInTheDocument();
// });


const MNEMONIC = '';
const { ContractFacade } = require('./facades/ContractFacade');
const { Deployer } = require('./facades/Deployer');


jest.setTimeout(1000000);

test('Deploy', async () => {
    const deployer = new Deployer();
    await deployer.initialize();

    return deployer.deployDelegator().then((contract) => {
        expect(contract).toBeDefined();
    });
});

// test('Initialize', async () => {
//     const facade = new ContractFacade();
//     await facade.initialize(MNEMONIC);

//     expect(facade.api).toBeDefined();
//     expect(facade.keyring).toBeDefined();
//     expect(facade.alice).toBeDefined();
//     expect(facade.contracts).toBeDefined();
// });

// test('RegisterDefence', async () => {
//     const facade = new ContractFacade();
//     await facade.initialize(MNEMONIC);

//     const selection = [10, 10, 10, 10];
//     const variants = [0, 0, 0, 0];
//     const commander = 0;
//     const name = 'TestAlice';
//     await facade.registerDefence(selection, variants, commander, name);

//     // const defence = await facade.getOwnDefence();

//     // expect(defence).toEqual([10, 10, 10, 10]);

// });
