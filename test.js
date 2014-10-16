#!/usr/bin/env node

var path = require('path');

var Promise = require('bluebird');
var test = require('tape');

var discoverable = require('./discoverable');

test('explicit packages', function(t) {
    var catalog = new discoverable.Catalog(path.resolve(__dirname, 'examples/explicit'));

    Promise.all([
        catalog.getModules('type1').then(function(modules) {
            t.equal(modules.length, 2);

            modulesEqual(t, modules[0], {
                type: 'type1',
                package: 'package1',
                filename: 'module1.js',
                exports: null
            });

            modulesEqual(t, modules[1], {
                type: 'type1',
                package: 'package1',
                filename: 'module2.js',
                exports: null
            });
        }),

        catalog.discover('type2', function(err, modules) {
            t.equal(modules.length, 1);
            t.equal(modules[0], 'type2.module1');
        })
    ])
    .nodeify(t.end);
});

function modulesEqual(t, a, b) {
    t.equal(a.type, b.type);
    t.equal(a.package, b.package);
    t.ok(new RegExp(b.filename.replace(/\./g, '\\.') + '$').test(a.filename));
    t.equal(a.exports, b.exports);
}
