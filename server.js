var fs = require('fs');
var config = JSON.parse(fs.readFileSync('.config/main.json', { encoding: 'UTF8' }));
