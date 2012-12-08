
var expect = require('expect.js');
var walker = require('../lib/walker');


describe('moonwalk()', function () {

    it('should generate AST if first arg is a string', function () {
        var count = 0;
        var ast = walker.moonwalk("function fn(x){\n  var foo = 'bar';\n  if (x) {\n  foo += 'baz';\n  } else {\n  foo += 's';\n   }\n  return foo;\n}", function(node){
            count++;
        });
        expect( ast.body ).not.to.be(undefined);
        expect( ast.tokens ).not.to.be(undefined);
        expect( count ).to.be.greaterThan( 1 );
    });

    it('should work with existing AST', function () {
        var ast = walker.parse("function fn(x){\n  var foo = 'bar';\n  if (x) {\n  foo += 'baz';\n  } else {\n  foo += 's';\n   }\n  return foo;\n}");
        var count = 0;
        walker.moonwalk(ast, function(node){
            count++;
        });
        expect( count ).to.be.greaterThan( 1 );
    });

    it('should walk AST starting from leaf nodes until it reaches the root', function () {
        var prevDepth = Infinity;
        var count = 0;
        var prevNode;
        var ast = walker.moonwalk("function fn(x){\n  var foo = 'bar';\n  if (x) {\n  foo += 'baz';\n  } else {\n  foo += 's';\n   }\n  return foo;\n}", function(node){
            count++;
            expect( node.depth <= prevDepth ).to.be( true );
            prevDepth = node.depth;
            prevNode = node;
        });
        expect( count ).to.be.greaterThan( 1 );
        expect( prevNode.type ).to.be( 'Program' ); // reached root
    });

});


describe('recursive()', function () {

    it('should allow breaking the loop', function () {
        var ast = walker.parse('function fn(x){ return x * 2 }');
        var count_1 = 0;
        walker.recursive(ast, function(node){
            count_1 += 1;
        });
        var count_2 = 0;
        walker.recursive(ast, function(node){
            count_2 += 1;
            if (node.type === 'BlockStatement') {
                return false; // break
            }
        });
        expect( count_1 ).to.be( 9 );
        expect( count_2 ).to.be( 5 );
    });

});


