# Discoverable

Discover packages and modules to compose your applications.

Discoverable adds the concept of module types. They're just strings that
represent whatever abstraction your applications need.

Applications declare what packages to scan for discoverable modules
in their package.json.

Packages declare what types they provide and what modules implement
those types in their package.json files.

## Install

```
npm i -S discoverable
```

## Usage

```
    var discoverable = require('discoverable');

    var things = discoverable.require('things');
```

## Configuration

Put this in your app's package.json:

```
  "discoverable": {
    "packages": "node_modules/*"
  }

```

`packages` is a glob pattern or an array of glob patterns.

Put this in your packages' package.json:

```
  "discoverable": {
    "modules": {
      "things": "lib/thing.js"
    }
  }
```

The properties in `modules` map types to modules. The property name is the
type name and the value is a glob pattern or an array of glob patterns.

Relative paths are resolved from the directory containing this package.json.

Applications can embed packages by setting `packages` to an object
and then defining the module mappings in another object:

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

With this configuration, it's not necessary to put package.json files in the
`lib/*` directories.

## API

The default export is a `Catalog` instance. It contains `Package` instances
which contain `Module` instances.

Constructors for all three of those types are exported so you could construct
your own instances or extend their prototypes.

### Catalog

- `addPackages(rootPath)`: discover packages for an application
- `addPackage(packagePath)`: discover modules for a package
- `getPackages(filter)`: query for packages
- `getModules(filter)`: query for modules
- `require(type)`: require modules

`filter` can be `{ package: 'name', type: 'type', module: 'name' }`.

When `filter` is a string, treated as `{ type: filter }`.

### Package

- `name`: the package name
- `addModules(packageDir, type, modules)`: add modules to the package
- `addModule(type, filename)`: add a module to the package
- `getModules(filter)`: query for modules
- `test(filter)`: test a package against a filter
- `has(type, name)`: test if a package has modules of a type with optional name
- `require(type)`: synchronously require all modules of a type

### Module

- `package`: the package name
- `type`: the module type
- `name`: the module name
- `filename`: the full path to the module
- `require()`: synchronously `require` the module
