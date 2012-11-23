
var walker = require('../lib/walker');


describe('moonwalk()', function () {

    it('should generate AST if first arg is a string', function () {
        var count = 0;
        var ast = walker.moonwalk("function fn(x){\n  var foo = 'bar';\n  if (x) {\n  foo += 'baz';\n  } else {\n  foo += 's';\n   }\n  return foo;\n}", function(node){
            count++;
        });
        expect( ast.body ).not.toBeUndefined();
        expect( ast.tokens ).not.toBeUndefined();
        expect( count ).toBeGreaterThan( 1 );
    });

    it('should work with existing AST', function () {
        var ast = walker.parse("function fn(x){\n  var foo = 'bar';\n  if (x) {\n  foo += 'baz';\n  } else {\n  foo += 's';\n   }\n  return foo;\n}");
        var count = 0;
        walker.moonwalk(ast, function(node){
            count++;
        });
        expect( count ).toBeGreaterThan( 1 );
    });

    it('should walk AST starting from leaf nodes until it reaches the root', function () {
        var prevDepth = Infinity;
        var count = 0;
        var prevNode;
        var ast = walker.moonwalk("function fn(x){\n  var foo = 'bar';\n  if (x) {\n  foo += 'baz';\n  } else {\n  foo += 's';\n   }\n  return foo;\n}", function(node){
            count++;
            expect( node.depth <= prevDepth ).toBe( true );
            prevDepth = node.depth;
            prevNode = node;
        });
        expect( count ).toBeGreaterThan( 1 );
        expect( prevNode.type ).toBe( 'Program' ); // reached root
    });

});

