var fs   = require('fs');
var path = require('path');

var Promise = require('bluebird');
var debug   = require('debug')('discoverable');
var glob    = require('glob');
var _       = require('lodash');

Promise.promisifyAll(fs);
var globAsync = Promise.promisify(glob);

//   ____      _        _
//  / ___|__ _| |_ __ _| | ___   __ _
// | |   / _` | __/ _` | |/ _ \ / _` |
// | |__| (_| | || (_| | | (_) | (_| |
//  \____\__,_|\__\__,_|_|\___/ \__, |
//                              |___/

function Catalog(options) {
    if (typeof options === 'string') {
        options = { root: options };
    }

    this.options = options || {};

    this.packages = [];

    this.promise = null;
}

Catalog.prototype.init = function() {
    if (!this.promise) {
        if (this.options.root) {
            debug('init %j', this.options.root);

            this.promise = this.addPackages(this.options.root).return(this.packages);
        } else {
            // Use require.main to find root?
            this.promise = Promise.resolve(this.packages);
        }
    }

    return this.promise;
};

Catalog.prototype.addPackages = function(rootPath) {
    debug('addPackages %j', rootPath);

    return Promise
        .bind(this)
        .then(function() { return json(rootPath); })
        .then(function(pkg) {
            if (pkg.discoverable && pkg.discoverable.packages) {
                var packages = pkg.discoverable.packages;
                if (typeof packages === 'string') {
                    packages = [ packages ];
                } else if (typeof packages === 'object' && !Array.isArray(packages)) {
                    packages = Object.keys(packages).map(function(glob) {
                        return {
                            glob: glob,
                            embedded: { discoverable: packages[glob] }
                        };
                    });
                }
                return packages.map(function(package) {
                    return typeof package === 'string'
                        ? { glob: package }
                        : package
                    ;
                });
            }
            return [];
        })
        .each(function(package) {
            return globAsync(slash(package.glob), { cwd: rootPath }).each(function(packagePath) {
                return this.addPackage(path.resolve(rootPath, packagePath), package.embedded);
            }.bind(this));
        })
    ;
};

Catalog.prototype.addPackage = function(packagePath, embedded) {
    debug('addPackage %j', packagePath);

    return Promise
        .bind(this)
        .then(function() { return embedded || json(packagePath); })
        .then(function(pkg) {
            var package = new Package(pkg.name || path.basename(packagePath));

            if (pkg.discoverable && pkg.discoverable.modules) {
                var modules = pkg.discoverable.modules;

                return Promise
                    .map(Object.keys(modules), function(type) {
                        return package.addModules(packagePath, type, modules[type]);
                    })
                    .all()
                    .then(function() {
                        this.packages.push(package);
                    }.bind(this))
                ;
            }
        })
    ;
};

Catalog.prototype.getPackages = function(type, callback) {
    return this
        .init()
        .filter(function(package) {
            return package.has(type);
        })
        .nodeify(callback)
    ;
};

Catalog.prototype.getModules = function(type, callback) {
    return this
        .getPackages(type)
        .reduce(function(modules, package) {
            return modules.concat(package.getModules(type));
        }, [])
        .all()
        .then(_.flatten)
        .nodeify(callback)
    ;
};

Catalog.prototype.discover = function(type, callback) {
    return this
        .getModules(type)
        .reduce(function(exports, module) {
            return exports.concat(module.require());
        }, [])
        .nodeify(callback)
    ;
};

//  ____            _
// |  _ \ __ _  ___| | ____ _  __ _  ___
// | |_) / _` |/ __| |/ / _` |/ _` |/ _ \
// |  __/ (_| | (__|   < (_| | (_| |  __/
// |_|   \__,_|\___|_|\_\__,_|\__, |\___|
//                            |___/

function Package(name) {
    this.name = name;
    this.modules = {};
}

Package.prototype.addModules = function(packageDir, type, modules) {
    debug('addModules %j', [ packageDir, type, modules ]);

    if (typeof modules === 'string') {
        modules = [ modules ];
    }

    return Promise
        .map(modules, function(module) {
            return globAsync(slash(module), { cwd: packageDir }).each(function(module) {
                return this.addModule(type, path.resolve(packageDir, module));
            }.bind(this));
        }.bind(this))
    ;
};

Package.prototype.addModule = function(type, filename) {
    debug('addModule %j', [ type, filename ]);

    if (!this.modules[type]) {
        this.modules[type] = [];
    }

    this.modules[type].push(new Module(type, this.name, filename));
};

Package.prototype.getModules = function(type) {
    return type && this.modules[type] || [];
};

Package.prototype.has = function(type) {
    return !type || (
        this.modules[type] &&
        this.modules[type].length > 0
    );
};

Package.prototype.require = function(type) {
    return this.getModules[type].map(function(module) {
        return module.require();
    });
};

//  __  __           _       _
// |  \/  | ___   __| |_   _| | ___
// | |\/| |/ _ \ / _` | | | | |/ _ \
// | |  | | (_) | (_| | |_| | |  __/
// |_|  |_|\___/ \__,_|\__,_|_|\___|

function Module(type, package, filename) {
    this.type = type;
    this.package = package;
    this.filename = filename;
    this.exports = null;
}

Module.prototype.require = function() {
    return this.exports || (this.exports = require(this.filename));
};

//  _   _ _   _ _ _ _   _
// | | | | |_(_) (_) |_(_) ___  ___
// | | | | __| | | | __| |/ _ \/ __|
// | |_| | |_| | | | |_| |  __/\__ \
//  \___/ \__|_|_|_|\__|_|\___||___/

function slash(path) {
    return path.replace(/\\/g, '/');
}

function json(dir) {
    // TODO: make sure does not already end in package.json?

    var file = path.resolve(dir, 'package.json')

    debug('loading %j', file);

    return Promise
        .try(function() { return fs.readFileAsync(file, 'utf8'); })
        .then(JSON.parse)
    ;
}

function mainPackage() {
    // Main module could be in sub-dir.
    // Look up path to find closest package.json.
    return path.resolve(path.dirname(require.main && require.main.filename));
}

//  _____                       _
// | ____|_  ___ __   ___  _ __| |_ ___
// |  _| \ \/ / '_ \ / _ \| '__| __/ __|
// | |___ >  <| |_) | (_) | |  | |_\__ \
// |_____/_/\_\ .__/ \___/|_|   \__|___/
//            |_|

var defaultCatalog = new Catalog(mainPackage());

module.exports = defaultCatalog.discover.bind(defaultCatalog);
module.exports.modules = defaultCatalog.getModules.bind(defaultCatalog);
module.exports.default = defaultCatalog;

module.exports.Catalog = Catalog;
module.exports.Package = Package;
module.exports.Module = Module;
