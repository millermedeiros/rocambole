/*jshint node:true */
"use strict";


var esprima = require('esprima');

var mixIn = require('amd-utils/object/mixIn');
var sort = require('amd-utils/array/sort');


// ---

var BYPASS_INSTRUMENT = {
    root : true,
    tokens : true, // we instrument tokens on another pass
    nodes : true,
    parent : true,
    next : true,
    prev : true
};


// ---


// parse string and return an augmented AST
exports.parse = function parse(source){
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

    // get the node string
    _nodeProto.toString = function(){
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
    ast.nodes = [];
    recursiveWalk(ast, function(node, parent, prev, next){
        node.parent = parent;
        node.prev = prev;
        node.next = next;
        node.depth = parent? parent.depth + 1 : 0; // used later for branching
        ast.nodes.push(node); // easier to loop afterwards
        // keep reference to original range since user might update the value
        // during the walk and that might cause issues
        node._range = node.range.slice();
        // mixIn for brevity
        mixIn(node, _nodeProto);
    });

    return ast;
};


function instrumentTokens(ast, source){
    ast.tokens.forEach(function(token, i, tokens){
        // TODO: add whitespace nodes before start of program
        token.index = i;
        token.prev = i? tokens[i - 1] : undefined;
        token.next = tokens[i + 1];

        // add white spaces
        if (i) {
            var prev = tokens[i - 1];
            if (prev.range[1] < token.range[0]) {
                var whiteSpace = {
                    type : 'WhiteSpace',
                    value : source.substring(prev.range[1], token.range[0]),
                    range : [ prev.range[1], token.range[0] ],
                    next : token,
                    prev : token.prev,
                    index : i,
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
                };
                // insert white space before
                tokens.splice(i, 0, whiteSpace);
                token.index += 1;
                token.prev.next = whiteSpace;
                token.prev = whiteSpace;
            }
        }
    });
}



exports.recursive = recursiveWalk;

// heavily inspired by node-falafel
function recursiveWalk(node, fn, parent, prev, next){
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
            recursiveWalk(child, fn, node);
        } else if ( Array.isArray(child) ) {
            child.forEach(function(c, i){
                recursiveWalk(c, fn, node, (i? child[i - 1] : undefined), child[i + 1] );
            });
        }

    });
}



// walk AST starting from leaf nodes
exports.moonwalk = function moonwalk(ast, fn){
    if (typeof ast === 'string') {
        ast = exports.parse(ast);
    }
    sort(ast.nodes, function(a, b){
        return b.depth - a.depth;
    }).forEach(fn);
    return ast;
};

