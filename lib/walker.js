/*jshint node:true */
"use strict";


var esprima = require('esprima');

var mixIn = require('amd-utils/object/mixIn');


// ---

var BYPASS_INSTRUMENT = {
    root : true,
    tokens : true, // we instrument tokens on another pass
    parent : true,
    next : true,
    prev : true
};


// ---


exports.parse = function(source){
    var ast = esprima.parse(source, {
        loc : true,
        range : true,
        tokens : true,
        comment : true
    });
    ast.source = source;
    var chunks = source.split('');
    ast._chunks = chunks;

    // node the most elegant solution to create the methods inline but that way
    // we avoid the need of circular references and abuse closures to keep
    // reference to the chunks and root ast
    var _nodeProto = {};

    // get the node source
    _nodeProto.source = function(){
        return chunks.slice(this._range[0], this._range[1]).join('');
    };

    // update string representation
    // XXX: maybe remove this method or enhance it to manipulate the real
    // tokens
    _nodeProto.update = function(str){
        chunks[this._range[0]] = str;
        for (var i = this._range[0] + 1; i < this._range[1]; i++) {
            chunks[i] = '';
        }
    };

    // get all original tokens inside the node
    _nodeProto.getTokens = function(){
        if (! ('_tokens' in this)) {
            var startRange = this._range[0];
            var endRange = this._range[1];
            this._tokens = ast.tokens.filter(function(token){
                return (token.range[0] >= startRange && token.range[1] <= endRange);
            });
        }
        return this._tokens;
    };

    _nodeProto.getPrevToken = function(){
        if (! ('_prevToken' in this) ) {
            var startRange = this._range[0];
            var n = ast.tokens.length, token;
            while (n--) {
                token = ast.tokens[n];
                if (token.range[1] <= startRange) {
                    this._prevToken = token;
                    break;
                }
            }
        }
        return this._prevToken;
    };

    _nodeProto.getNextToken = function(){
        if(! ('_nextToken' in this) ) {
            var endRange = this._range[1];
            var i = 0, token;
            while (token = ast.tokens[i++]) {
                if (token.range[0] >= endRange) {
                    this._nextToken = token;
                    break;
                }
            }
        }
        return this._nextToken;
    };


    _nodeProto.getStartToken = function(){
        if (! ('_startToken' in this)) {
            var tokens = this.getTokens();
            this._startToken = tokens[0];
        }
        return this._startToken;
    };


    _nodeProto.getEndToken = function(){
        if (! ('_endToken' in this)) {
            var tokens = this.getTokens();
            this._endToken = tokens[tokens.length - 1];
        }
        return this._endToken;
    };


    instrumentTokens(ast, source);

    // instrument nodes
    forwardWalk(ast, function(node, parent, prev, next){
        node.parent = parent;
        node.prev = prev;
        node.next = next;
        node.depth = parent? parent.depth + 1 : 0; // used later for branching
        node._range = node.range.slice(); // keep reference to original range
        // mixIn for brevity
        mixIn(node, _nodeProto);
    });


    return ast;
};


function instrumentTokens(ast, source){
    ast.tokens.forEach(function(token, i, tokens){
        // TODO: add whitespace nodes before start of program
        token.index = i;

        // add white spaces
        if (i) {
            var prev = tokens[i - 1];
            if (prev.range[1] < token.range[0]) {
                tokens.splice(i, 0, {
                    type : 'WhiteSpace',
                    value : source.substring(prev.range[1], token.range[0]),
                    range : [ prev.range[1], token.range[0] ],
                    loc : {
                        start : {
                            line : prev.loc.end.line,
                            column : prev.loc.end.column
                        },
                        end : {
                            line : token.loc.start.line,
                            column : token.loc.start.column
                        }
                    }
                });
            }
        }
    });
}




// heavily inspired by node-falafel
function forwardWalk(node, fn, parent, prev, next){
    if (typeof node !== 'object') {
        return false;
    }

    // execute only once per node
    if ( fn(node, parent, prev, next) === false ) {
        return; // break
    }

    Object.keys(node).forEach(function(key){
        var child = node[key];

        // only need to recurse real nodes and arrays
        // ps: typeof null == 'object'
        if (child == null || typeof child !== 'object' || key in BYPASS_INSTRUMENT) {
            return;
        }

        // inception
        if (typeof child.type === 'string') {
            forwardWalk(child, fn, node);
        } else if ( Array.isArray(child) ) {
            child.forEach(function(c, i){
                forwardWalk(c, fn, node, (i? child[i - 1] : undefined), child[i + 1] );
            });
        }

    });
}

