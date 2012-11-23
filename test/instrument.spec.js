
var _esprima = require('esprima');
var walker = require('../lib/walker');


describe('parse', function () {


    it('should parse string and return AST', function () {
        var ast = walker.parse('(function(){ return 123 })');
        expect( ast.type ).toEqual( 'Program' );
        expect( ast.body[0].type ).toEqual( 'ExpressionStatement' );
    });


    describe('falafel-like methods/properties', function () {

        var ast, program, expressionStatement,
            fnExpression, block, returnStatement;

        this.beforeEach(function(){
            ast = walker.parse('(function(){ return 123 })');
            program = ast;
            expressionStatement = ast.body[0];
            fnExpression = expressionStatement.expression;
            block = fnExpression.body;
            returnStatement = block.body[0];
        });


        it('should add reference to parent node', function () {
            expect( program.parent ).toEqual( undefined );
            expect( expressionStatement.parent ).toEqual( program );
            expect( fnExpression.parent ).toEqual( expressionStatement );
            expect( block.parent ).toEqual( fnExpression );
        });

        it('should add source() method', function () {
            expect( returnStatement.type ).toEqual( 'ReturnStatement' );
            expect( returnStatement.source() ).toEqual( 'return 123 ' );
        });

        it('should add update() method', function () {
            returnStatement.update('return "foo"');
            expect( returnStatement.source() ).toEqual( 'return "foo"' );
        });

        it('should add depth property to nodes', function () {
            expect( program.depth ).toEqual( 0 );
            expect( expressionStatement.depth ).toEqual( 1 );
            expect( fnExpression.depth ).toEqual( 2 );
            expect( block.depth ).toEqual( 3 );
            expect( returnStatement.depth ).toEqual( 4 );
        });

    });


    describe('Node Tokens', function () {

        var ast, program, expressionStatement,
            fnExpression, block, returnStatement;

        // this.beforeEach(function(){
            ast = walker.parse('(function(){ return 123;})');
            program = ast;
            expressionStatement = ast.body[0];
            fnExpression = expressionStatement.expression;
            block = fnExpression.body;
            returnStatement = block.body[0];
        // });

        describe('node.getTokens()', function () {
            it('should return tokens inside range', function () {
                expect( returnStatement.type ).toEqual( 'ReturnStatement' );

                var tokens = returnStatement.getTokens();
                expect( tokens[0].value ).toEqual( 'return' );

                // space is also a token
                expect( tokens[1].type ).toEqual( 'WhiteSpace' );
                expect( tokens[1].value ).toEqual( ' ' );

                expect( tokens[2].value ).toEqual( '123' );

                // yes, the semicolon is a token inside the return statement
                expect( tokens[3].value ).toEqual( ';' );

                expect( tokens.length ).toEqual( 4 );
            });
        });

        describe('node.getNextToken()', function () {
            it('should return next token', function () {
                var token = returnStatement.getNextToken();
                expect( token.type ).toEqual( 'Punctuator' );
                expect( token.value ).toEqual( '}' );
            });
        });

        describe('node.getPrevToken()', function () {
            it('should return previous token', function () {
                var token = returnStatement.getPrevToken();
                expect( token.type ).toEqual( 'WhiteSpace' );
                expect( token.value ).toEqual( ' ' );
            });
        });

        describe('node.getEndToken()', function () {
            it('should return last token inside node', function () {
                var token = returnStatement.getEndToken();
                expect( token.value ).toEqual( ';' );
            });
        });

        describe('node.getStartToken()', function () {
            it('should return last token inside node', function () {
                var token = returnStatement.getStartToken();
                expect( token.value ).toEqual( 'return' );
            });
        });

    });



    describe('Node.next & Node.prev', function () {

        it('should return reference to previous and next nodes', function () {
            var ast = walker.parse("function foo(){\n  var bar = 'baz';\n  var lorem = 'ipsum';\n  return bar + lorem;\n}");
            var block = ast.body[0].body.body;
            var firstNode = block[0];
            var secondNode = block[1];
            var lastNode = block[2];
            expect( firstNode.prev ).toEqual( undefined );
            expect( firstNode.next ).toEqual( secondNode );
            expect( secondNode.prev ).toEqual( firstNode );
            expect( secondNode.next ).toEqual( lastNode );
            expect( lastNode.prev ).toEqual( secondNode );
            expect( lastNode.next ).toEqual( undefined );
        });

    });

});

