# Rocambole [![Build Status](https://secure.travis-ci.org/millermedeiros/rocambole.png?branch=master)](https://travis-ci.org/millermedeiros/rocambole)

![rocambole](https://raw.github.com/millermedeiros/rocambole/master/rocambole.jpg)

Recursively walk and add extra information/helpers to [Esprima / Mozilla
SpiderMonkey Parser API](http://esprima.org/doc/index.html#ast) compatible AST.

The main difference between other tools is that it also keeps information about
tokens and white spaces and it is meant to be used to transform the tokens and
not the string values itself.

This library is specially useful for non-destructive AST manipulation.


## Inspiration

This module was heavily inspired by
[node-falafel](https://github.com/substack/node-falafel) and
[node-burrito](https://github.com/substack/node-burrito) but I needed more
information than what is currently available on falafel (specially about
tokens, empty lines and white spaces) and also needed to do the node traversing
on the opposite order (start from leaf nodes). The amount of changes required
to introduce the new features and the differences on the concept behind the
tool justified a new project.

It was created mainly to be used on
[esformatter](https://github.com/millermedeiros/esformatter/).



## Extra Tokens

Besides all the regular tokens returned by `esprima` we also add a few more
that are important for non-destructive transformations:

 * `WhiteSpace`
   - Can store multiple white spaces (tabs are considered white space, line
     breaks not). Important if you want to do non-destructive replacements that
     are white-space sensitive.
   - Multiple subsequent white spaces are treated as a single token.
 * `LineBreak`
 * `LineComment`
 * `BlockComment`



## Extra Properties

Each Node have the following extra properties/methods:

  - `parent` : Node|undefined
  - `toString()` : string
  - `next` : Node|undefined
  - `prev` : Node|undefined
  - `depth` : Number
  - `startToken` : Token
  - `endToken` : Token

Each token also have:

 - `prev` : Token|undefined
 - `next` : Token|undefined

You should **treat the tokens as a linked list instead of reading the
`ast.tokens` array** (inserting/removing items from a linked list is very cheap
and won't break the loop). You should grab a reference to the `node.startToken`
and get `token.next` until you find the desired token or reach the end of the
program. To loop between all tokens inside a node you can do like this:

```js
var token = node.startToken;
while (token !== node.endToken.next) {
    doStuffWithToken(token);
    token = token.next;
}
```

The method `toString` loops through all tokens between `node.startToken` and
`node.endToken` grabbing the `token.raw` (used by comments) or `token.value`
properties. To implement a method similar to falafel `update()` you can do
this:

```js
function update(node, str){
    var newToken = {
        type : 'Custom', // can be anything (not used internally)
        value : str
    };
    // update linked list references
    if ( node.startToken.prev ) {
        node.startToken.prev.next = newToken;
    }
    if ( node.endToken.next ) {
        node.endToken.next.prev = newToken;
    }
    node.startToken = node.endToken = newToken;
}
```

I plan to add some helper methods and/or create a separate project
(rocambole-utils). For now I'm adding the helpers on the [esformatter util
package](https://github.com/millermedeiros/esformatter/tree/master/lib/util)
but I plan to extract the generic ones.



## API


### rocambole.parse

Parses a string and instrument the AST with extra properties/methods.

```js
var rocambole = require('rocambole');
var ast = rocambole.parse(string);
console.log( ast.startToken );
// to get a string representation of all tokens call toString()
console.log( ast.toString() );
```


### rocambole.moonwalk

The `moonwalk()` starts at the leaf nodes and go down the tree until it reaches
the root node (`Program`). Each node will be traversed only once.

```js
rocambole.moonwalk(ast, function(node){
    if (node.type == 'ArrayExpression'){
        console.log( node.depth +': '+ node.toString() );
    }
});
```

Traverse order:

```
 Program [#18]
 `-FunctionDeclaration [#16]
   |-BlockStatement [#14]
   | |-IfStatement [#12]
   | | |-BynaryExpression [#9]
   | | | |-Identifier [#4]
   | | | `-Literal [#5]
   | | `-BlockStatement [#10]
   | |   `-ExpressionStatement [#6]
   | |     `-AssignmentExpression [#3]
   | |       |-Identifier [#1 walk starts here]
   | |       `-Literal [#2]
   | `-VariableDeclaration [#13]
   |   `-VariableDeclarator [#11]
   |     |-Identifier [#7]
   |     `-Literal [#8]
   `-ReturnStatement [#17]
     `-Identifier [#15]
```

This behavior is very different from node-falafel and node-burrito.


### rocambole.recursive

It loops through all nodes on the AST starting from the root node (`Program`),
similar to `node-falafel`.

```js
rocambole.recursive(ast, function(node){
    console.log(node.type);
});
```


## Popular Alternatives

 - [burrito](https://github.com/substack/node-burrito)
 - [falafel](https://github.com/substack/node-falafel)



## Unit Tests

Besides the regular unit tests we also use
[istanbul](https://github.com/yahoo/istanbul) to generate code coverage
reports, tests should have at least 95% code coverage for statements, branches
and lines and 100% code coverage for functions or travis build will fail.

We do not run the coverage test at each call since it slows down the
performnace of the tests and it also makes it harder to see the test results.
To execute tests and generate coverage report call `npm test --coverage`, for
regular tests just do `npm test`.

Coverage reports are not committed to the repository since they will change at
each `npm test --coverage` call.



## License

MIT



## Changelog

### v0.2.3 (2013/01/08)

 - improve `rocambole.parse()` performance by 4500%. (#4)
 - improve `rocambole.moonwalk()` performance by 11000%.

### v0.2.2 (2012/12/19)

 - fix consecutive comments before start of program. (#3)

### v0.2.1 (2012/12/13)

 - fix `loc` info on `WhiteSpace` and `LineBreak` tokens. (#2)

### v0.2.0 (2012/12/09)

 - Deprecated:
   - `token.before()`
   - `token.after()`
   - `token.remove()`
   - `node.getTokens()`
   - `ast.nodes`
 - avoid recursion over comments.
 - fix weird bug on esformatter introduced on v0.1.1 related to `token._ast`
   property.

### v0.1.1 (2012/12/08)

 - Improve token manipulation methods behavior (`before`, `after`, `remove`)

### v0.1.0 (2012/12/06)

 - Initial release

