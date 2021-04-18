'use strict';

const fs = require('fs');

const argv = process.argv.slice(2);
const delegator_address = argv[0];
const jsonContent = {
  delegator_address,
};

fs.writeFile('src/config/config.json', JSON.stringify(jsonContent), 'utf8', (err) => {
    if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
    }
});
