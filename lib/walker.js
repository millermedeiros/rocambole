/*jshint node:true */
"use strict";


var esprima = require('esprima');

var mixIn = require('amd-utils/object/mixIn');


// ---

var INJECTED_KEYS = {
    parent : true,
    update : true,
    source : true,
    root : true,
    getOriginalTokens : true,
    tokens : true
};


// ---


exports.instrument = function(source){
    var ast = parse(source);
    ast.source = source;
    ast.root = ast; // inception
    ast._chunks = source.split('');

    // it will instrument regular ast and tokens
    forwardWalk(ast, undefined, function(node, parent){
        node.root = ast; // inception, easier to navigate
        node.parent = parent;
        node.depth = parent? parent.depth + 1 : 0;
        node._range = node.range.slice(); // keep reference to original range
        // mixIn for brevity
        mixIn(node, _nodeProto);
    });

    // injectComments(ast);

    addWhiteSpaceTokens(ast, source);

    return ast;
};


function addWhiteSpaceTokens(ast, source){
    ast.tokens.forEach(function(token, i, tokens){
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


// function injectComments(ast){
    // // comments are ignored by program range if they are outside any block
    // ast.range[0] = Math.min( ast.range[0], ast.comments[0].range[0] );
    // ast.comments.forEach(function(comment){
        // comment.type = 'Line'? 'CommentLine' : 'CommentBlock';

        // forwardWalk(ast, undefined, function(node, parent){
            // if (! parent) return;
            // if (parent.range[0] <= comment.range[0] && parent.range[1] >= comment.range[1] ) {
                // if (node.range[0] >= comment.range[0]) {
                    // return false;
                // }
            // }
        // });
    // });
// }



function parse(source){
    return esprima.parse(source, {
        loc : true,
        range : true,
        tokens : true,
        comment : true
    });
}


// heavily inspired by node-falafel
function forwardWalk(node, parent, fn){
    if (typeof node !== 'object') {
        return false;
    }

    if ( fn(node, parent) === false ) {
        // break
        return;
    }

    Object.keys(node).forEach(function(key){
        // bypass injected keys
        if (key in INJECTED_KEYS) return;

        var child = node[key];
        if ( Array.isArray(child) ) {
            child.forEach(function(c){
                forwardWalk(c, node, fn);
            });
        }
        else if (child && typeof child.type === 'string') {
            if ( fn(child, node) === false ) {
                return;
            }
            forwardWalk(child, node, fn);
        }

    });
}


var _nodeProto = {};

// get the node source
_nodeProto.source = function(){
    return this.root._chunks.slice(this._range[0], this._range[1]).join('');
};

_nodeProto.update = function(str){
    this.root._chunks[this._range[0]] = str;
    for (var i = this._range[0] + 1; i < this._range[1]; i++) {
        this.root._chunks[i] = '';
    }
};

// get all original tokens inside the node
_nodeProto.getOriginalTokens = function(){
    var startRange = this._range[0];
    var endRange = this._range[1];
    return this.root.tokens.filter(function(token){
        return (token.range[0] >= startRange && token.range[1] <= endRange);
    });
};
