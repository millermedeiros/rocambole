/*jshint node:true */
"use strict";


var esprima = require('esprima');



// ---

var BYPASS_RECURSION = {
    root : true,
    comments : true,
    tokens : true,
    parent : true,
    next : true,
    prev : true,
    startToken : true,
    endToken : true
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
    recursiveWalk(ast, function(node, parent, prev, next){
        node.parent = parent;
        node.prev = prev;
        node.next = next;
        node.depth = parent? parent.depth + 1 : 0; // used later for moonwalk

        node.toString = _nodeProto.toString;

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


var _nodeProto = {};

// get the node string
_nodeProto.toString = function(){
    var str = '';
    var token = this.startToken;
    do {
        str += ('raw' in token)? token.raw : token.value;
        token = token.next;
    } while (token && token !== this.endToken.next);
    return str;
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




function instrumentTokens(ast, source){

    // --- inject comments into tokens list
    ast.comments.forEach(function(com, i){
         // yes, we create a new object to avoid modifying the ast.comments
        var comment = {
            type : com.type + 'Comment',
            value : com.value,
            raw : com.type === 'Block'? '/*'+ com.value +'*/' : '//'+ com.value,
            range : com.range.slice(),
            loc : {
                start : {
                    line : com.loc.start.line,
                    column : com.loc.start.column
                },
                end : {
                    line : com.loc.end.line,
                    column : com.loc.end.column
                }
            }
        };

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
    // also avoid mistakes
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

    // need to come afterwards since we add line breaks and comments
    tokens.forEach(function(token, i){
        token.prev = i? tokens[i - 1] : undefined;
        token.next = tokens[i + 1];
        token.root = ast; // used internally
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
                    if (buf) {
                        result.push(buf);
                    }
                    result.push(value); // unix break
                }
                buf = '';
                break;
            case '\r':
                // might be multiple consecutive Mac breaks
                if (buf) {
                    result.push(buf);
                }
                buf = value;
                break;
            default:
                if (buf === '\r') {
                    result.push(buf);
                    buf = value;
                } else {
                    // group multiple white spaces into same token
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
// walk nodes recursively starting from root
function recursiveWalk(node, fn, parent, prev, next){
    if (typeof node !== 'object') {
        return false;
    }

    if ( fn(node, parent, prev, next) === false ) {
        return; // stop recursion
    }

    Object.keys(node).forEach(function(key){
        var child = node[key];

        // only need to recurse real nodes and arrays
        // ps: typeof null == 'object'
        if (child == null || typeof child !== 'object' || BYPASS_RECURSION[key]) {
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
    // simplified sorted insert based on node.depth
    var nodes = [];
    recursiveWalk(ast, function(node){
        var n = nodes.length;
        var cur;
        do {
            cur = nodes[--n];
        } while (cur && node.depth > cur.depth);
        nodes.splice(n + 1, 0, node);
    });
    nodes.forEach(fn);
    return ast;
};

