# Discoverable

Discover packages and modules to compose your applications.

Packages declare what types they provide and what modules implement those types
in their package.json files.

Applications declare what packages to scan for discoverable modules in their
package.json files.

It's a layer of indirection between your code and your dependencies. Use
`discover('foo')` in your code and configure what specific modules implement
"foo" in your package.json.

## Install

```
npm i -S discoverable
```

## Usage

```
var discover = require('discoverable');

discover('things').then(function(things) {
  // use things here
});

// or

discover('things', function(err, things) {
  // use things here
});
```

## Configuration

### Packages

A package is discoverable if it has something like this in its package.json:

```
  "discoverable": {
    "modules": {
      "things": "lib/things/*.js",
      "otherThings": "lib/other/*-thing.js"
    }
  }
```

To be more selective, do this:

```
  "discoverable": {
    "modules": {
      "things": [
        "lib/thing1.js",
        "lib/thing2.js"
      ],
      "otherThings": "lib/other/other-thing.js"
    }
  }
```

There are no requirements on what modules must export, but they should be
polymorphic for any given type.

### Applications

If the packages you need are public and discoverable, install them with npm
and put this in your package.json:

```
  "discoverable": {
    "packages": "node_modules/*"
  }
```

If you want to be more selective, do this:

```
  "discoverable": {
    "packages": [
      "node_modules/foo",
      "node_modules/bar"
    ]
  }
```

If the packages you want to discover aren't discoverable (or not even
proper packages), do this:

```
  "discoverable": {
    "packages": {
      "lib/*": {
        "modules": {
          "things": "lib/things/*.js"
        }
      }
    }
  }
```

You can be as selective as you want.

## API

The default export is a function:

```
var discover = require('discoverable');
```

### discover

Discovers and requires modules of the given type.

Arguments:

- `type` - `String`
- `callback` - `function(err, modules)` (optional)

Returns:

- `Promise` for `Array` of the modules' exports

### discover.modules

Discovers modules of a given type without require'ing them.

Arguments:

- `type` - `String`
- `callback` - `function(err, modules)` (optional)

Returns:

- `Promise` for `Array` of modules objects that look like this:

```
{
    type: 'type',
    package: 'name', // from "name" in package.json or directory name
    filename: '/path/to/module.js',
    name: 'module', // from filename
    exports: null, // might be defined if previously required
    require: function() {
      // requires the module, later returns cached exports
    }
}
```
