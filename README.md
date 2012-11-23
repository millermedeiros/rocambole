# EcmaScript AST Walker

Add extra information/helpers to [Esprima / Mozilla SpiderMonkey Parser
API](http://esprima.org/doc/index.html#ast) compatible AST and provides
different methods for walking the tree recursively.

The main difference about other tools is that it also keeps information about
tokens and white spaces.


## Inpiration

This module was heavily inspired by
[node-falafel](https://github.com/substack/node-falafel) but I needed more
information than what is currently available on falafel (specially about
tokens, empty lines and white spaces). The amount of changes required to
introduce the new features and the differences on the concept behind the tool
justifies a new project.


## Extra AST Nodes

Besides all the regular nodes present on the [Esprima
AST](http://esprima.org/doc/index.html#ast) this tool also adds a couple more:
They will be ordered according to the original `range`.

 * Comment
  - Esprima keeps comments on a separate Array, we add it to the AST body since
    in many cases the comment location is important.


## Extra Tokens

 * WhiteSpace
  - Can store multiple white spaces (tabs and line breaks are considered white
    space).



## Extra Properties

Each node and token have the following extra properties/methods:

 * inpired by falafel:
  - parent : Node|undefined
  - update(newStringValue)
  - source() : string
 * traversing:
  - nextNode() : Node|undefined
  - prevNode() : Node|undefined
  - prevToken() : Token|undefined
  - nextToken() : Token|undefined
 * manipulation:
  - insertNodeBefore(node)
  - insertNodeAfter(node)
  - insertTokenAfter(token)
  - insertTokenBefore(token)
  - insertLineBreakBefore(nLines = 1, br = '\n')
  - insertLineBreakAfter(nLines = 1, br = '\n')
  - insertWhiteSpaceBefore(nSpaces = 1, spaceChar = ' ')
  - insertWhiteSpaceAfter(nSpaces = 1, spaceChar = ' ')

Nodes also have these extra methods:

 - startToken() : Token|undefined
 - endToken() : Token|undefined


## Notes

Calling `update()` on each node will trigger a new parse of the node body by
Esprima to make sure we get all tokens info and also line breaks that might be
added by the `update()` call.

The recursive walk starts at the leaf nodes and go down the tree until it
reaches the root node (`Program`). The tree will be divided into *branches*
during the traversing, leaf nodes will be processed until they find a sibling
branch that wasn't processed yet, lets supposed we have a program with
following structure:

 1. Program [#24]
  2. FunctionDeclaration [#23]
   1. BlockStatement [#22]
    1. IfStatement [#19 switch branch]
     1. BynaryExpression [#18]
      1. Identifier [#17]
      2. Literal [#16]
     2. BlockStatement [#15 switch branch]
      1. IfStatement [#9 switch branch]
       1. BynaryExpression [#8]
        1. Identifier [#7]
        2. Literal [#6]
       2. BlockStatement [#5 switch branch]
        1. ExpressionStatement [#4]
         1. AssignmentExpression [#3]
          1. Identifier [#2]
          2. Literal [#1 walk start from here]
      2. BlockStatement [#14]
       1. ExpressionStatement [#13]
        1. AssignmentExpression [#12]
         1. Identifier [#11]
         2. Literal [#10]
  2. ReturnStatement [#21]
   1. Identifier [#20]

The walk would start from deepest node which in this case is the node
`2.1.1.2.1.2.1.1.2. Literal` and would follow the steps from 1-24 until it
reaches the root node. Each node will be traversed only once.


## API

```js
var walker = require('es-ast-walker');

// you can pass a regular AST or a codeString, codeString will give more
// details since we can keep the original whiteSpace information
var ast = walker.instrument(ast | codeString);

// walk() starts from the deepest node and walk the tree backwards
var result = walker.walk(instrumentedAst | ast | codeString, function(node){
    if (node.type == 'ArrayExpression'){
        node.update( 'fn('+ node.source() +')' );
    }
});
```


## Popular Alternatives

 - [burrito](https://github.com/substack/node-burrito)
 - [falafel](https://github.com/substack/node-falafel)


## License

MIT


