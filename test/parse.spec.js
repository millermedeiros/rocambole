
var _esprima = require('esprima');
var walker = require('../lib/walker');


describe('parse', function () {

    it('should parse string and return AST', function () {
        var ast = walker.parse('(function(){ return 123 })');
        expect( ast.type ).toEqual( 'Program' );
        expect( ast.body[0].type ).toEqual( 'ExpressionStatement' );
    });


    it('should include tokens before and after "program" end', function () {
        var ast = walker.parse('//foo\n(function(){ return 123 })\n//bar');
        expect( ast.startToken.value ).toEqual( 'foo' );
        expect( ast.endToken.value ).toEqual( 'bar' );
    });


    describe('node basic methods/properties', function () {

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

        it('toString should return the node source', function () {
            expect( returnStatement.type ).toEqual( 'ReturnStatement' );
            expect( returnStatement.toString() ).toEqual( 'return 123 ' );
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
            ast = walker.parse('(function(){\n  return 123; // foo\n})');
            program = ast;
            expressionStatement = ast.body[0];
            fnExpression = expressionStatement.expression;
            block = fnExpression.body;
            returnStatement = block.body[0];
        // });

        describe('node.getTokens()', function () {
            it('should return an array of tokens inside range', function () {
                expect( returnStatement.type ).toEqual( 'ReturnStatement' );

                var tokens = returnStatement.getTokens();

                expect( tokens[0].type ).toEqual( 'Keyword' );
                expect( tokens[0].value ).toEqual( 'return' );

                // console.log( tokens.map(function(t){ return [t.range, t.value] }) )


                // space is also a token
                expect( tokens[1].type ).toEqual( 'WhiteSpace' );
                expect( tokens[1].value ).toEqual( ' ' );

                expect( tokens[2].type ).toEqual( 'Numeric' );
                expect( tokens[2].value ).toEqual( '123' );

                // yes, the semicolon is a token inside the return statement
                expect( tokens[3].type ).toEqual( 'Punctuator' );
                expect( tokens[3].value ).toEqual( ';' );

                expect( tokens.length ).toEqual( 4 );
            });

            it('should include comments and line breaks', function () {
                var tokens = block.getTokens();
                expect( tokens[tokens.length - 3].type ).toEqual( 'LineComment' );
                expect( tokens[tokens.length - 2].type ).toEqual( 'LineBreak' );
                expect( tokens[tokens.length - 1].type ).toEqual( 'Punctuator' );
            });
        });

        describe('node.nextToken / token.next', function () {
            it('should return next token', function () {
                var token = returnStatement.nextToken;
                expect( token.type ).toEqual( 'WhiteSpace' );
                expect( token.value ).toEqual( ' ' );

                // just so we make sure token.next works after
                // node#nextToken
                var comment = token.next;
                expect( comment.type ).toEqual( 'LineComment' );
                expect( comment.value ).toEqual( ' foo' );
                var br = comment.next;
                expect( br.type ).toEqual( 'LineBreak' );
                expect( br.value ).toEqual( '\n' );
                var closing = br.next;
                expect( closing.type ).toEqual( 'Punctuator' );
                expect( closing.value ).toEqual( '}' );
            });
        });


        describe('node.prevToken', function () {
            it('should return previous token', function () {
                var token = returnStatement.prevToken;
                expect( token.type ).toEqual( 'WhiteSpace' );
                expect( token.value ).toEqual( '  ' );
            });
        });

        describe('node.endToken', function () {
            it('should return last token inside node', function () {
                var token = returnStatement.endToken;
                expect( token.value ).toEqual( ';' );
            });
        });

        describe('node.startToken', function () {
            it('should return last token inside node', function () {
                var token = returnStatement.startToken;
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


    describe('Token', function () {

        it('should instrument tokens', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var tokens = ast.tokens;

            expect( tokens[0].prev ).toBeUndefined();
            expect( tokens[0].next ).toBe( tokens[1] );
            expect( tokens[1].prev ).toBe( tokens[0] );
            expect( tokens[1].next ).toBe( tokens[2] );
        });

    });

});

