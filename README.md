# Rocambole : Recursively walk and transform EcmaScript AST

Add extra information/helpers to [Esprima / Mozilla SpiderMonkey Parser
API](http://esprima.org/doc/index.html#ast) compatible AST and provides
different methods for walking the tree recursively.

The main difference between other tools is that it also keeps information about
tokens and white spaces and it is meant to be used to transform the tokens and
not the string values itself.

This library is specially useful for non-destructive AST manipulation.


## Inspiration

This module was heavily inspired by
[node-falafel](https://github.com/substack/node-falafel) and
[node-burrito](https://github.com/substack/node-burrito) but I needed more
information than what is currently available on falafel (specially about
tokens, empty lines and white spaces).

The amount of changes required to introduce the new features and the
differences on the concept behind the tool justified a new project.



## Extra Tokens

Besides all the regular tokens returned by `esprima` we also add a few more
that are important for non-destructive transformations.

 * WhiteSpace
   - Can store multiple white spaces (tabs are considered white space, line
     breaks not). Important if you want to do non-destructive replacements that
     are white-space sensitive.
   - Multiple subsequent white spaces are treated as a single token.
 * LineBreak
 * LineComment
 * BlockComment



## Extra Properties

Each Node have the following extra properties/methods:

  - parent : Node|undefined
  - toString() : string
  - next : Node|undefined
  - prev : Node|undefined
  - depth : Number
  - startToken : Token
  - endToken : Token
  - getTokens() : Array<Token>

Each token also have:

 - prev : Token|undefined
 - next : Token|undefined
 - before(newToken)
  - insert a new token before
 - after(newToken)
  - insert a new token after
 - remove()
  - remove token from the tree

PS: all manipulation methods update `range` and `loc` of all tokens till the
end of the list.

The AST root (Program) also have an extra property `nodes`, which contain all
Nodes that are present inside the `Program.body`. The `nodes` array is *not*
sorted on any specific way, order of elements is not guaranteed. It is used
internally by the `moonwalk`.

You should threat the tokens as a linked list, so to loop between all tokens
inside a node you can do like this:

```js
var token = node.startToken;
while (token !== node.endToken.next) {
    doStuffWithToken(token);
    token = token.next;
}
```



## Notes

The `moonwalk()` starts at the leaf nodes and go down the tree until it reaches
the root node (`Program`). Each node will be traversed only once.

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

This behavior is very different from node-falafel and node-burrito.



## API

```js
var rocambole = require('rocambole');

// it parses a string and instrument the AST with extra properties/methods
var instrumentedAst = rocambole.parse(string);

// moonwalk() starts from the deepest nodes and walk the tree backwards
rocambole.moonwalk(instrumentedAst, function(node){
    if (node.type == 'ArrayExpression'){
        console.log( node.toString() );
    }
});

// you also have the option to do a recursive walk (similar to node-falafel)
rocambole.recursive(instrumentedAst, function(node){
    console.log(node.type);
});

// call toString() to get a string representation of all tokens
var result = instrumentedAst.toString();
```



## Popular Alternatives

 - [burrito](https://github.com/substack/node-burrito)
 - [falafel](https://github.com/substack/node-falafel)




## TODO

 - add a method similar to falafel `node.update(str)` but that actually
   converts the string into tokens before inserting.



## License

MIT


