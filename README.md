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



## Extra Tokens

 * WhiteSpace
  - Can store multiple white spaces (tabs and line breaks are considered white
    space). Important if you want to do non-destructive replacements that are
    white-space sensitive.



## Extra Properties

Each Node have the following extra properties/methods:

  - parent : Node|undefined
  - update(newStringValue)
  - toString() : string
  - next : Node|undefined
  - prev : Node|undefined
  - depth : Number
  - getStartToken() : Token
  - getEndToken() : Token
  - getPrevToken() : Token|undefined
  - getNextToken() : Token|undefined
  - getTokens() : Array<Token>

The AST root (Program) also have an extra property `nodes`, which contain all
Nodes that are present inside the `Program.body`. The `nodes` array is *not*
sorted on any specific way, order of elements is not guaranteed.



## Notes

The `moonwalk()` starts at the leaf nodes and go down the tree until it reaches
the root node (`Program`).

```
 Program [#18]
 |-FunctionDeclaration [#16]
 | |-BlockStatement [#14]
 | | |-IfStatement [#12]
 | | | |-BynaryExpression [#9]
 | | | | |-Identifier [#4]
 | | | | `-Literal [#5]
 | | | `-BlockStatement [#10]
 | | |   `-ExpressionStatement [#6]
 | | |     `-AssignmentExpression [#3]
 | | |       |-Identifier [#1 walk starts here]
 | | |       `-Literal [#2]
 | | `-VariableDeclaration [#13]
 | |   `-VariableDeclarator [#11]
 | |     |-Identifier [#7]
 | |     `-Literal [#8]
   `-ReturnStatement [#17]
     `-Identifier [#15]
```

The walk would start from deepest node and would follow the steps from 1-18
until it reaches the root node. Each node will be traversed only once.

The `getTokens()` method only retuns the orignal tokens, if you `update()` the
node content it won't reflect the new tokens. Maybe this behavior will change
in the future since it would be cool to be able to replace the tokens at will.



## API

```js
var walker = require('es-ast-walker');

// you can pass a regular AST or a codeString, codeString will give more
// details since we can keep the original whiteSpace information
var instrumentedAst = walker.parse(string);

// moonwalk() starts from the deepest nodes and walk the tree backwards
var result = walker.moonwalk(instrumentedAst, function(node){
    if (node.type == 'ArrayExpression'){
        node.update( 'fn('+ node.toString() +')' );
    }
});
```


## Popular Alternatives

 - [burrito](https://github.com/substack/node-burrito)
 - [falafel](https://github.com/substack/node-falafel)


## License

MIT


