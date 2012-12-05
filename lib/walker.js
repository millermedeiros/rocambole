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

    // node the most elegant solution to create the methods inline but that way
    // we avoid the need of circular references and abuse closures to keep
    // reference to the root ast
    var _nodeProto = {};

    // get the node string
    _nodeProto.toString = function(){
        return this.getTokens().map(function(t){ return ('raw' in t)? t.raw : t.value; }).join('');
    };


    // get all tokens that are inside the node
    _nodeProto.getTokens = function(){
        var result = [];
        var token = this.startToken;
        do {
            result.push(token);
            token = token.next;
        } while (token && token !== this.endToken.next);
        return result;
    };

    instrumentTokens(ast, source);

    // update program range since it doesn't include white spaces and comments
    // before/after the program body by default
    var lastToken = ast.tokens[ast.tokens.length - 1];
    ast.range[0] = ast.tokens[0].range[0];
    ast.range[1] = lastToken.range[1];
    ast.loc.start.line = 0;
    ast.loc.start.column = 0;
    ast.loc.end.line = lastToken.loc.end.line;
    ast.loc.end.column = lastToken.loc.end.column;

    // instrument nodes
    ast.nodes = [];
    recursiveWalk(ast, function(node, parent, prev, next){
        node.parent = parent;
        node.prev = prev;
        node.next = next;
        node.depth = parent? parent.depth + 1 : 0; // used later for moonwalk
        ast.nodes.push(node); // easier to loop afterwards
        // mixIn for brevity
        mixIn(node, _nodeProto);
    });

    // do on a separate step to avoid too much recursion
    ast.nodes.forEach(function(node){
        // TODO: simplify getPrevToken/getNextToken logic, it could start on
        // the next/prev node and use the linked list for the loop
        // we do not add nextToken and prevToken to avoid updating even more
        // references during each remove/before/after you can grab the
        // prev/next token by simply accesing the startToken.prev and
        // endToken.next
        var prevToken = getPrevToken(ast.tokens, node.range);
        var nextToken = getNextToken(ast.tokens, node.range);
        node.startToken = prevToken? prevToken.next : ast.tokens[0];
        node.endToken = nextToken? nextToken.prev : ast.tokens[ast.tokens.length - 1];
    });

    return ast;
};



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


var _tokenProto = {};

//TODO: add loc/range info dynamically based on target and newToken.value/raw
_tokenProto.before = function(newToken) {
    var target = this;
    updateRangeTillEnd(target, newToken.range[1] - newToken.range[0], newToken.loc.end.line - newToken.loc.start.line);
    newToken.prev = target.prev;
    newToken.next = target;
    if (target.prev) {
        target.prev.next = newToken;
    }
    target.prev = newToken;
    mixIn(newToken, _tokenProto);
};

_tokenProto.after = function(newToken) {
    var target = this;
    if (target.next) {
        updateRangeTillEnd(target.next, newToken.range[1] - newToken.range[0], newToken.loc.end.line - newToken.loc.start.line);
    }
    newToken.prev = target;
    newToken.next = target.next;
    target.next = newToken;
    mixIn(newToken, _tokenProto);
};

_tokenProto.remove = function(){
    if (this.next) {
        updateRangeTillEnd(this.next, this.range[0] - this.range[1], this.loc.start.line - this.loc.end.line);
        this.next.prev = this.prev;
    }
    if (this.prev) {
        this.prev.next = this.next;
    }
};


function updateRangeTillEnd(startToken, diffColumns, diffLines){
    diffColumns = diffColumns || 0 ;
    diffLines = diffLines || 0 ;
    do {
        startToken.range[0] += diffColumns;
        startToken.range[1] += diffColumns;
        startToken.loc.start.column += diffColumns;
        startToken.loc.end.column += diffColumns;
        startToken.loc.start.line += diffLines;
        startToken.loc.end.line += diffLines;
    } while (startToken = startToken.next);
}


function instrumentTokens(ast, source){

    // --- inject comments into tokens list
    ast.comments.forEach(function(comment, i, comments){
        comment = merge(comment, {
            type : comment.type + 'Comment',
            raw : comment.type === 'Block'? '/*'+ comment.value +'*/' : '//'+ comment.value
        });
        var prev = getPrevToken(ast.tokens, comment.range);
        var prevIndex = prev? ast.tokens.indexOf(prev) : -1;
        if (!prevIndex && i) {
            ast.tokens.push(comment);
        } else {
            ast.tokens.splice(prevIndex + 1, 0, comment);
        }
    });

    // --- inject white spaces and line breaks

    // we create a new array since it's simpler than using splice, it will
    // avoid mistakes
    var tokens = [];

    // insert white spaces before start of program
    var firstToken = ast.tokens[0];
    var raw;
    if ( firstToken.range[0] ) {
        raw = source.substring(0, firstToken.range[0]);
        tokens = tokens.concat( getWhiteSpaceTokens(raw, null) );
    }

    // insert white spaces between regular tokens
    ast.tokens.forEach(function(token, i){
        if (i) {
            var prev = ast.tokens[i - 1];
            if (prev.range[1] < token.range[0]) {
                var str = source.substring(prev.range[1], token.range[0]);
                tokens = tokens.concat( getWhiteSpaceTokens(str, prev) );
            }
        }
        tokens.push(token);
    });

    // insert white spaces after end of program
    var lastToken = ast.tokens[ast.tokens.length - 1];
    if (lastToken.range[1] < source.length) {
        raw = source.substring(lastToken.range[1], source.length);
        tokens = tokens.concat( getWhiteSpaceTokens(raw, lastToken) );
    }

    // --- instrument tokens

    // do it afterwards since it's simpler, specially because of white spaces
    // and line break tokens (could be merged into previous forEach tho)
    tokens.forEach(function(token, i){
        token.prev = i? tokens[i - 1] : undefined;
        token.next = tokens[i + 1];
        // for brevity
        mixIn(token, _tokenProto);
    });

    ast.tokens = tokens;

}


function getWhiteSpaceTokens(raw, prev){
    var whiteSpaces = getWhiteSpaces(raw);

    var startRange = prev? prev.range[1] : 0;
    var startLine = prev? prev.loc.end.line : 0;
    var startColumn = prev? prev.loc.end.column : 0;

    var tokens = whiteSpaces.map(function(value, k){
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

        return wsToken;
    });

    return tokens;
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

