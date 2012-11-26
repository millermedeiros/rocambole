/*jshint node:true */
"use strict";


var esprima = require('esprima');

var mixIn = require('amd-utils/object/mixIn');
var merge = require('amd-utils/object/merge');
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

    // node the most elegant solution to create the methods inline but that way
    // we avoid the need of circular references and abuse closures to keep
    // reference to the chunks and root ast
    var _nodeProto = {};

    // get the node string
    _nodeProto.toString = function(){
        return chunks.slice(this._range[0], this._range[1]).join('');
        // return this.getTokens().map(function(t){ return ('raw' in t)? t.raw : t.value; }).join('');
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
            this._tokens = getTokensInRange(ast.tokens, this._range);
        }
        return this._tokens;
    };

    _nodeProto.getPrevToken = function(){
        if (! ('_prevToken' in this) ) {
            this._prevToken = getPrevToken(ast.tokens, this._range);
        }
        return this._prevToken;
    };

    _nodeProto.getNextToken = function(){
        if(! ('_nextToken' in this) ) {
            this._nextToken = getNextToken(ast.tokens, this._range);
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


function getTokensInRange(tokens, range) {
    return tokens.filter(function(token){
        return (token.range[0] >= range[0] && token.range[1] <= range[1]);
    });
}


function getPrevToken(tokens, range){
    var result, token,
        startRange = range[0],
        n = tokens.length;
    while (n--) {
        token = tokens[n];
        if (token.range[1] <= startRange) {
            result = token;
            break;
        }
    }
    return result;
}


function getNextToken(tokens, range){
    var result, token,
        endRange = range[1],
        i = 0;
    while (token = tokens[i++]) {
        if (token.range[0] >= endRange) {
            result = token;
            break;
        }
    }
    return result;
}


function instrumentTokens(ast, source){

    // inject comments into tokens list
    ast.comments.forEach(function(comment, i, comments){
        var prev = getPrevToken(ast.tokens, comment.range);
        comment = merge(comment, {
            type : comment.type + 'Comment'
        });
        var prevIndex = prev? ast.tokens.indexOf(prev) : -1;
        ast.tokens.splice(prevIndex + 1, 0, comment);
    });

    // TODO: add whitespace nodes before start of program

    // inject white spaces and line breaks
    // we create a new array since it's simpler than using splice, it will
    // avoid issues
    var tokens = [];
    ast.tokens.forEach(function(token, i){
        if (i) {
            var prev = ast.tokens[i - 1];
            if (prev.range[1] < token.range[0]) {
                var whiteSpaces = getWhiteSpaces( source.substring(prev.range[1], token.range[0]) );
                var startRange = prev.range[1];
                var startLine = prev.loc.end.line;
                var startColumn = prev.loc.end.column;

                whiteSpaces.forEach(function(value, k){
                    var wsToken = { value : value };
                    var isBr = (/[\r\n]/).test(value);
                    wsToken.type = isBr? 'LineBreak' : 'WhiteSpace';
                    wsToken.range = [startRange, startRange + value.length];
                    wsToken.loc = {
                        start : {
                            line : startLine,
                            column : startColumn
                        },
                        end : {
                            line : isBr? startLine + 1 : startLine,
                            column : startColumn + value.length
                        }
                    };

                    startLine = wsToken.loc.end.line;
                    startColumn = isBr? 0 : wsToken.loc.end.column;

                    startRange += value.length;

                    // push whitespaces before current token
                    tokens.push(wsToken);
                });
            }
        }
        tokens.push(token);
    });

    // instrument tokens, do it afterwards since it's simpler, specially
    // because of white spaces and line break tokens (could be merged into
    // previous forEach tho)
    tokens.forEach(function(token, i){
        token.index = i;
        token.prev = i? tokens[i - 1] : undefined;
        token.next = tokens[i + 1];
    });

    ast.tokens = tokens;

}


function getWhiteSpaces(source) {
    var result = [];
    var whiteSpaces = source.split('');
    var buf = '';
    whiteSpaces.forEach(function(value, i, whiteSpaces){
        switch(value){
            case '\n':
                if (buf === '\r') {
                    result.push(buf + value); // DOS line break
                } else {
                    if (buf !== '') {
                        result.push(buf);
                    }
                    result.push(value); // unix break
                }
                buf = '';
                break;
            case '\r':
                // might be multiple consecutive Mac breaks
                if (buf !== '') {
                    result.push(buf);
                }
                buf = value;
                break;
            default:
                if (buf === '\r') {
                    result.push(buf);
                    buf = value;
                } else {
                    buf += value;
                }
        }
    });
    if (buf) {
        result.push(buf);
    }
    return result;
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

