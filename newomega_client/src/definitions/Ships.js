import { Color3 } from '@babylonjs/core';


export const Ships = [
    {
        name: 'Hunter',
        asset: 'assets/drone_v9_cybertech/',
        description: 'Cheap, quick and agile, the Hunter can be used as a quick strike weapon, able to reach enemy lines quickest. Can not withstand much heat though.',
        stats: {
            cp: 1,
            hp: 120,
            attack: {
                base: 80,
                variable: 20,
            },
            defence: 20,
            speed: 4,
            range: 4,
        },
        scale: 1000,
        combatScale: 0.6,
        visuals: {
            beamColor: new Color3(0, 1, 0),
            beamWidth: Math.PI / 256,
        },
    },
    {
        name: 'Scorpio',
        asset: 'assets/drone_v2/',
        description: 'As lightest of the heavier ships, the Scorpio retains some of the speed and maneuverability of the frigate while offering big improvements in the hull and weaponry.',
        stats: {
            cp: 3,
            hp: 150,
            attack: {
                base: 65,
                variable: 20,
            },
            defence: 30,
            speed: 3,
            range: 8,
        },
        scale: 1400,
        combatScale: 0.6,
        visuals: {
            beamColor: new Color3(0.2, 0.2, 1),
            beamWidth: Math.PI / 96,
            rotationModifierY: -1,
        },
    },
    {
        name: 'Zeneca',
        asset: 'assets/zeneca_brute/',
        description: 'The Zeneca is an effective killing machine, providing both active support and serving as an artillery line raining heavy damage on enemy ships.',
        stats: {
            cp: 4,
            hp: 220,
            attack: {
                base: 65,
                variable: 20,
            },
            defence: 35,
            speed: 2,
            range: 15,
        },
        scale: 400,
        combatScale: 0.8,
        visuals: {
            beamColor: new Color3(1, 1, 1),
            beamWidth: Math.PI / 96,
            rotationModifierY: 2,
            rotationOddOffsetY: Math.PI,
        },
    },
    {
        name: 'Luminaris',
        asset: 'assets/luminaris_starship/',
        description: 'Fitted with state of the art weaponry and protection, the Luminaris is the ultimate fighting force in the galaxy.',
        stats: {
            cp: 10,
            hp: 450,
            attack: {
                base: 80,
                variable: 20,
            },
            defence: 40,
            speed: 1,
            range: 30,
        },
        scale: 120,
        combatScale: 0.8,
        visuals: {
            beamColor: new Color3(1, 0, 1),
            beamWidth: Math.PI / 64,
        },
    },
];
