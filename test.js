#!/usr/bin/env node

var path = require('path');

var test = require('tape');

var discoverable = require('./discoverable');

test('explicit packages', function(t) {
    var catalog = new discoverable.Catalog(path.resolve(__dirname, 'examples/explicit'));

    catalog.getPackages()
        .tap(function(packages) {
            t.equal(packages.length, 1);
            t.equal(packages[0].name, 'package1');

            return packages[0].getModules('type1')
                .tap(function(modules) {
                    t.equal(modules.length, 1);
                    t.equal(modules[0].package, 'package1');
                    t.equal(modules[0].type, 'type1');
                    t.equal(modules[0].name, 'module1');
                    t.equal(modules[0].exports, null);

                    return modules[0].require().then(function(exports) {
                        t.equal(modules[0].exports, exports);
                        t.equal(exports, 'exports1');
                    });
                })
                .tap(function(modules) {
                    // Ensure getting modules from the catalog returns the same modules we got from the package.
                    return catalog.getModules('type1').then(function(catalogModules) {
                        t.equal(modules[0], catalogModules[0]);
                    });
                })
            ;
        })
        .nodeify(t.end)
    ;
});
