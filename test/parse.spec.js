/*global describe:false, it:false */
"use strict";

var expect = require('expect.js');
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


    it('should work with any kind of line breaks & spaces', function () {
        var ast = walker.parse('\nvar n\r\n=\n10;\r\r  \t\t  \n');

        var br_1 = ast.startToken;
        expect( br_1.type ).to.be( 'LineBreak' );
        expect( br_1.value ).to.be( '\n' );
        expect( br_1.range ).to.eql( [0, 1] );
        expect( br_1.loc ).to.eql({
            start : {
                line : 1,
                column : 0
            },
            end : {
                line : 1,
                column : 1
            }
        });

        var ws_1 = ast.startToken.next.next;
        expect( ws_1.type ).to.be( 'WhiteSpace' );
        expect( ws_1.value ).to.be( ' ' );

        var br_2 = br_1.next.next.next.next;
        expect( br_2.type ).to.be( 'LineBreak' );
        expect( br_2.value ).to.be( '\r\n' );
        expect( br_2.range ).to.eql( [6, 8] );
        expect( br_2.loc ).to.eql({
            start : {
                line : 2,
                column : 5
            },
            end : {
                line : 2,
                column : 7
            }
        });

        // it's important to notice that esprima doesn't parse "\r" as line
        // break, so if it is not at EOF it will give conflicting "loc" info.
        var br_6 = ast.endToken;
        expect( br_6.type ).to.be( 'LineBreak' );
        expect( br_6.value ).to.be( '\n' );
        expect( br_6.range ).to.eql( [21, 22] );
        expect( br_6.loc ).to.eql({
            start : {
                line : 6,
                column : 6
            },
            end : {
                line : 6,
                column : 7
            }
        });

        var ws_2 = ast.endToken.prev;
        expect( ws_2.type ).to.be( 'WhiteSpace' );
        expect( ws_2.value ).to.be( '  \t\t  ' );
        expect( ws_2.range ).to.eql( [15, 21] );
        expect( ws_2.loc ).to.eql({
            start : {
                line : 6,
                column : 0
            },
            end : {
                line : 6,
                column : 6
            }
        });

        var br_5 = ws_2.prev;
        expect( br_5.type ).to.be( 'LineBreak' );
        expect( br_5.value ).to.be( '\r' );

        var br_4 = br_5.prev;
        expect( br_4.type ).to.be( 'LineBreak' );
        expect( br_4.value ).to.be( '\r' );
    });


    it('should not include any char that isn\'t a white space on a WhiteSpace token [issue #3]', function () {
        var ast = walker.parse("\n/* foo */\n/* bar */\nfunction foo(){\n  var bar = 'baz';\n\n  //foo\n  //bar\n\n  var lorem = 'ipsum';\n  return bar + lorem;\n}");
        var tk = ast.startToken;
        var nComments = 0;
        while (tk) {
            if (tk.type === 'WhiteSpace') {
                expect( tk.value ).to.match( /^[\s\t]+$/ );
            } else if (tk.type === 'LineBreak') {
                expect( tk.value ).to.equal( '\n' );
            } else if (tk.type === 'LineComment') {
                expect( tk.raw ).to.match( /^\/\/\w{3}$/ );
                nComments++;
            } else if (tk.type === 'BlockComment') {
                expect( tk.raw ).to.match( /^\/\* \w{3} \*\/$/ );
                nComments++;
            }
            tk = tk.next;
        }
        expect( nComments ).to.be( 4 );
    });

    describe('Node', function () {

        var ast = walker.parse('/* block */\n(function(){\n return 123; // line\n})');
        var program = ast;
        var expressionStatement = ast.body[0];
        var fnExpression = expressionStatement.expression;
        var block = fnExpression.body;
        var returnStatement = block.body[0];


        describe('node.parent', function () {
            it('should add reference to parent node', function () {
                expect( program.parent ).to.equal( undefined );
                expect( expressionStatement.parent ).to.equal( program );
                expect( fnExpression.parent ).to.equal( expressionStatement );
                expect( block.parent ).to.equal( fnExpression );
            });
        });


        describe('node.toString()', function(){
            it('should return the node source', function () {
                expect( returnStatement.type ).to.equal( 'ReturnStatement' );
                expect( returnStatement.toString() ).to.equal( 'return 123;' );
            });
            it('should use raw value of comments', function () {
                expect( block.toString() ).to.equal( '{\n return 123; // line\n}' );
            });
            it('should use raw value of comments', function () {
                expect( ast.toString() ).to.equal( '/* block */\n(function(){\n return 123; // line\n})' );
            });
        });


        describe('depth', function () {
            it('should add depth property to nodes', function () {
                expect( program.depth ).to.equal( 0 );
                expect( expressionStatement.depth ).to.equal( 1 );
                expect( fnExpression.depth ).to.equal( 2 );
                expect( block.depth ).to.equal( 3 );
                expect( returnStatement.depth ).to.equal( 4 );
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

        it('should add range and loc info to comment tokens', function () {
            var ast = walker.parse('\n/* foo\n  bar\n*/\nfunction foo(){ return "bar"; }\n// end');
            var blockComment = ast.startToken.next;
            expect( blockComment.range ).to.eql( [1, 16] );
            expect( blockComment.loc ).to.eql({
                start : {
                    line : 2,
                    column : 0
                },
                end : {
                    line : 4,
                    column : 2
                }
            });
            var lineComment = ast.endToken;
            expect( lineComment.range ).to.eql( [49, 55] );
            expect( lineComment.loc ).to.eql({
                start : {
                    line : 6,
                    column : 0
                },
                end : {
                    line : 6,
                    column : 6
                }
            });
        });

    });




});

