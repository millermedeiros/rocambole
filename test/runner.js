// we run mocha manually otherwise istanbul coverage won't work
// run `npm test --coverage` to generate coverage report

var Mocha = require('mocha');

var m = new Mocha({
    ui : 'bdd',
    reporter : 'dot'
});

m.addFile('test/parse.spec.js');
m.addFile('test/moonwalk.spec.js');

m.run(function(){
    process.exit();
});

