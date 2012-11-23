
var _esprima = require('esprima');
var walker = require('../lib/walker');


describe('Instrument', function () {



    describe('basic', function () {

        it('should parse string and return AST', function () {
            var ast = walker.instrument('(function(){ return 123 })');
            expect( ast.type ).toEqual( 'Program' );
            expect( ast.body[0].type ).toEqual( 'ExpressionStatement' );
        });

        describe('falafel-like methods/properties', function () {

            it('should add reference to parent node', function () {
                var ast = walker.instrument('(function(){ return 123 })');
                var program = ast;
                var expressionStatement = ast.body[0];
                var fnExpression = expressionStatement.expression;
                var block = fnExpression.body;
                expect( program.parent ).toEqual( undefined );
                expect( expressionStatement.parent ).toEqual( program );
                expect( fnExpression.parent ).toEqual( expressionStatement );
                expect( block.parent ).toEqual( fnExpression );
            });

            it('should add source() method', function () {
                var ast = walker.instrument('(function(){ return 123 })');
                var rs = ast.body[0].expression.body.body[0];
                expect( rs.type ).toEqual( 'ReturnStatement' );
                expect( rs.source() ).toEqual( 'return 123 ' );
            });

            it('should add update() method', function () {
                var ast = walker.instrument('(function(){ return 123 })');
                var returnStatement = ast.body[0].expression.body.body[0];
                returnStatement.update('return "foo"');
                expect( returnStatement.source() ).toEqual( 'return "foo"' );
            });

        });


        describe('node.getOriginalTokens()', function () {
            it('should return tokens inside range', function () {
                var ast = walker.instrument('(function(){ return 123; })');
                var returnStatement = ast.body[0].expression.body.body[0];
                expect( returnStatement.type ).toEqual( 'ReturnStatement' );

                var tokens = returnStatement.getOriginalTokens();
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

    });



});

