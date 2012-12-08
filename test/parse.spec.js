
var expect = require('expect.js');

var _esprima = require('esprima');
var walker = require('../lib/walker');


describe('parse', function () {

    it('should parse string and return AST', function () {
        var ast = walker.parse('(function(){ return 123 })');
        expect( ast.type ).to.equal( 'Program' );
        expect( ast.body[0].type ).to.equal( 'ExpressionStatement' );
    });


    it('should include tokens before and after "program" end', function () {
        var ast = walker.parse('//foo\n(function(){ return 123 })\n//bar\n');
        expect( ast.startToken.value ).to.equal( 'foo' );
        expect( ast.endToken.value ).to.equal( '\n' );
        ast = walker.parse('\n//foo\n(function(){ return 123 })\n//dolor');
        expect( ast.startToken.value ).to.equal( '\n' );
        expect( ast.endToken.value ).to.equal( 'dolor' );
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
            expect( program.parent ).to.equal( undefined );
            expect( expressionStatement.parent ).to.equal( program );
            expect( fnExpression.parent ).to.equal( expressionStatement );
            expect( block.parent ).to.equal( fnExpression );
        });

        it('toString should return the node source', function () {
            expect( returnStatement.type ).to.equal( 'ReturnStatement' );
            expect( returnStatement.toString() ).to.equal( 'return 123 ' );
        });

        it('should add depth property to nodes', function () {
            expect( program.depth ).to.equal( 0 );
            expect( expressionStatement.depth ).to.equal( 1 );
            expect( fnExpression.depth ).to.equal( 2 );
            expect( block.depth ).to.equal( 3 );
            expect( returnStatement.depth ).to.equal( 4 );
        });

    });


    describe('Node Tokens', function () {

        var ast, program, expressionStatement,
            fnExpression, block, returnStatement;

            ast = walker.parse('(function(){\n  return 123; // foo\n})');
            program = ast;
            expressionStatement = ast.body[0];
            fnExpression = expressionStatement.expression;
            block = fnExpression.body;
            returnStatement = block.body[0];


        describe('node.getTokens()', function () {
            it('should return an array of tokens inside range', function () {
                expect( returnStatement.type ).to.equal( 'ReturnStatement' );

                var tokens = returnStatement.getTokens();

                expect( tokens[0].type ).to.equal( 'Keyword' );
                expect( tokens[0].value ).to.equal( 'return' );

                // space is also a token
                expect( tokens[1].type ).to.equal( 'WhiteSpace' );
                expect( tokens[1].value ).to.equal( ' ' );

                expect( tokens[2].type ).to.equal( 'Numeric' );
                expect( tokens[2].value ).to.equal( '123' );

                // yes, the semicolon is a token inside the return statement
                expect( tokens[3].type ).to.equal( 'Punctuator' );
                expect( tokens[3].value ).to.equal( ';' );

                expect( tokens.length ).to.equal( 4 );
            });

            it('should include comments and line breaks', function () {
                var tokens = block.getTokens();
                expect( tokens[tokens.length - 3].type ).to.equal( 'LineComment' );
                expect( tokens[tokens.length - 2].type ).to.equal( 'LineBreak' );
                expect( tokens[tokens.length - 1].type ).to.equal( 'Punctuator' );
            });

            it('comment toString should use raw value', function () {
                expect( block.toString() ).to.equal( '{\n  return 123; // foo\n}' );
            });

        });


        describe('node.endToken', function () {
            it('should return last token inside node', function () {
                var token = returnStatement.endToken;
                expect( token.value ).to.equal( ';' );
            });
        });

        describe('node.startToken', function () {
            it('should return last token inside node', function () {
                var token = returnStatement.startToken;
                expect( token.value ).to.equal( 'return' );
            });
        });

    });


    describe('Node.next & Node.prev', function () {

        it('should return reference to previous and next nodes', function () {
            var ast = walker.parse("\n/* foo */\n/* bar */\nfunction foo(){\n  var bar = 'baz';\n  var lorem = 'ipsum';\n  return bar + lorem;\n}");
            var block = ast.body[0].body.body;
            var firstNode = block[0];
            var secondNode = block[1];
            var lastNode = block[2];
            expect( firstNode.prev ).to.equal( undefined );
            expect( firstNode.next ).to.equal( secondNode );
            expect( secondNode.prev ).to.equal( firstNode );
            expect( secondNode.next ).to.equal( lastNode );
            expect( lastNode.prev ).to.equal( secondNode );
            expect( lastNode.next ).to.equal( undefined );
        });

    });


    describe('Token', function () {

        it('should instrument tokens', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var tokens = ast.tokens;

            expect( tokens[0].prev ).to.be(undefined);
            expect( tokens[0].next ).to.be( tokens[1] );
            expect( tokens[1].prev ).to.be( tokens[0] );
            expect( tokens[1].next ).to.be( tokens[2] );
        });

    });


    describe('token.before()', function () {

        it('should insert token before target', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var target = ast.startToken;
            var tk = {
                type : 'Punctuator',
                value : '!!!',
                range : [0, 3],
                loc : {
                    start : {
                        line : 0,
                        column : 0
                    },
                    end : {
                        line : 0,
                        column : 3
                    }
                }
            };

            var next = target.next;
            var nextOriginalRange = next.range.slice();
            var endOriginalRange = ast.endToken.range.slice();

            target.before(tk);
            expect( target.prev ).to.be( tk );
            expect( tk.prev ).to.be( undefined );
            expect( tk.next ).to.be( target );
            expect( tk.before ).to.be.a( 'function' );
            // tricky and clearly an edge case
            expect( ast.startToken.value ).to.be( tk.value );

            expect( next.range[0] ).to.be( nextOriginalRange[0] + 3);
            expect( next.range[1] ).to.be( nextOriginalRange[1] + 3);
            expect( ast.endToken.range[0] ).to.be( endOriginalRange[0] + 3);
            expect( ast.endToken.range[1] ).to.be( endOriginalRange[1] + 3);
        });


        it('should update target.prev.next reference', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var target = ast.startToken.next;
            var tk = {
                type : 'Punctuator',
                value : ';'
            };
            target.before(tk);
            expect( target.prev ).to.be( tk );
            expect( tk.prev ).to.be( ast.startToken );
            expect( tk.next ).to.be( target );
            expect( tk.before ).to.be.a( 'function' );
        });

        it('should allow inserting any token type', function () {
            var ast = walker.parse('function foo()\r\r    {\r\nreturn "bar"; }');
            var target = ast.startToken.next;
            var tk = {
                type : 'void',
                value : ''
            };
            target.before(tk);
            expect( target.prev ).to.be( tk );
            expect( tk.prev ).to.be( ast.startToken );
            expect( tk.next ).to.be( target );
            expect( tk.before ).to.be.a( 'function' );

            var tk_2 = {
                type : 'LineBreak',
                value : '\r\n'
            };
            target.before(tk_2);
            expect( target.prev ).to.be( tk_2 );
            expect( tk_2.prev ).to.be( tk );
            expect( tk_2.next ).to.be( target );
            expect( tk_2.before ).to.be.a( 'function' );
        });

    });


    describe('token.after()', function () {

        it('should insert token after target', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var target = ast.startToken;
            var next = target.next;
            var tk = {
                type : 'Punctuator',
                value : ';'
            };
            var nextOriginalRange = next.range.slice();
            var endOriginalRange = ast.endToken.range.slice();

            target.after(tk);
            expect( target.next ).to.be( tk );
            expect( tk.prev ).to.be( target );
            expect( tk.next ).to.be( next );
            expect( next.prev ).to.be( tk );
            expect( tk.after ).to.be.a( 'function' );

            expect( next.range[0] ).to.be( nextOriginalRange[0] + 1);
            expect( next.range[1] ).to.be( nextOriginalRange[1] + 1);
            expect( ast.endToken.range[0] ).to.be( endOriginalRange[0] + 1);
            expect( ast.endToken.range[1] ).to.be( endOriginalRange[1] + 1);
        });

        it('should update ast.endToken reference if inserted at end', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var target = ast.endToken;
            var tk = {
                type : 'Punctuator',
                value : ';',
                range : [9, 10],
                loc : {
                    start : {
                        line : 0,
                        column : 9
                    },
                    end : {
                        line : 0,
                        column : 10
                    }
                }
            };
            target.after(tk);
            expect( target.next ).to.be( tk );
            expect( tk.prev ).to.be( target );
            expect( tk.next ).to.be( undefined );
            expect( ast.endToken ).to.be( tk );
            expect( tk.after ).to.be.a( 'function' );
        });

        it('should allow inserting any token type', function () {
            var ast = walker.parse('function foo()\r\r    {\r\nreturn "bar"; }');
            var target = ast.startToken.next;
            var next= target.next;
            var tk = {
                type : 'void',
                value : ''
            };
            target.after(tk);
            expect( target.next ).to.be( tk );
            expect( tk.prev ).to.be( ast.startToken.next );
            expect( tk.next ).to.be( next );

            var tk_2 = {
                type : 'LineBreak',
                value : '\r\n'
            };
            target.after(tk_2);
            expect( target.next ).to.be( tk_2 );
            expect( tk_2.prev ).to.be( target );
            expect( tk_2.next ).to.be( tk );
        });

    });


    describe('token.remove()', function () {

        it('should remove token from the tree', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var target = ast.startToken;
            var next = target.next;
            target.remove();
            expect( next.prev ).to.be( undefined );
            expect( target.next ).to.be( undefined );
            expect( target.prev ).to.be( undefined );
            expect( ast.startToken ).to.be( next );
        });

        it('should update ast.endToken reference if removing last token', function () {
            var ast = walker.parse('function foo(){ return "bar"; }');
            var target = ast.endToken;
            var prev = target.prev;
            target.remove();
            expect( prev.next ).to.be( undefined );
            expect( target.next ).to.be( undefined );
            expect( target.prev ).to.be( undefined );
            expect( ast.endToken ).to.be( prev );
        });

    });


});

