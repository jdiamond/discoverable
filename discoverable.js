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

Catalog.prototype.discover = function() {
    if (!this.promise) {
        if (this.options.root) {
            debug('discover %j', this.options.root);
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
                }
                return packages;
            }
            return [];
        })
        .each(function(package) {
            return globAsync(slash(package), { cwd: rootPath }).each(function(packagePath) {
                return this.addPackage(path.resolve(rootPath, packagePath));
            }.bind(this));
        })
    ;
};

Catalog.prototype.addPackage = function(packagePath, callback) {
    debug('addPackage %j', packagePath);

    return Promise
        .bind(this)
        .then(function() { return json(packagePath); })
        .then(function(pkg) {
            var package = new Package(pkg.name);

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

Catalog.prototype.getPackages = function(filter, callback) {
    return this
        .discover()
        .filter(function(package) {
            return package.test(filter);
        })
        .nodeify(callback)
    ;
};

Catalog.prototype.getModules = function(filter, callback) {
    return this
        .getPackages(filter)
        .reduce(function(modules, package) {
            return modules.concat(package.getModules(filter));
        }, [])
        .all()
        .then(_.flatten)
        .nodeify(callback)
    ;
};

Catalog.prototype.require = function(filter, callback) {
    return this
        .getModules(filter)
        .reduce(function(exports, module) {
            return exports.concat(module.require(filter));
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
    this._modules = {};
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

    if (!this._modules[type]) {
        this._modules[type] = [];
    }

    var name = path.basename(filename);
    name = name.slice(0, -path.extname(name).length);

    this._modules[type].push(new Module(this.name, type, name, filename));
};

Package.prototype.getModules = function(filter) {
    return new Promise(function(resolve, reject) {
        if (!filter) {
            return resolve([]);
        }

        var moduleType = filter;
        var moduleName;

        if (typeof filter === 'object') {
            moduleType = filter.type;
            moduleName = filter.module;
        }

        if (!moduleType || !this._modules[moduleType]) {
            return resolve([]);
        }

        resolve(this._modules[moduleType].filter(function(module) {
            return match(module.name, moduleName);
        }));
    }.bind(this));
};

Package.prototype.require = function(filter) {
    if (this.has(type)) {
        var pkg = this;

        return this.modules[type].map(function(module) {
            return module.require();
        });
    }

    return [];
};

Package.prototype.test = function(filter) {
    if (!filter) {
        return true;
    } else if (typeof filter === 'string') {
        return this.has(filter);
    } else if (typeof filter === 'object') {
        return match(this.name, filter.package) && this.has(filter.type, filter.module);
    }
};

Package.prototype.has = function(moduleType, moduleName) {
    return !moduleType || (
        this._modules[moduleType] &&
        this._modules[moduleType].length > 0 &&
        this._modules[moduleType].some(function(module) {
            return match(module.name, moduleName);
        })
    );
};

//  __  __           _       _
// |  \/  | ___   __| |_   _| | ___
// | |\/| |/ _ \ / _` | | | | |/ _ \
// | |  | | (_) | (_| | |_| | |  __/
// |_|  |_|\___/ \__,_|\__,_|_|\___|

function Module(package, type, name, filename) {
    this.package = package;
    this.type = type;
    this.name = name;
    this.filename = filename;
    this.exports = null;
}

Module.prototype.require = function(callback) {
    if (this.exports) {
        return Promise.resolve(this.exports).nodeify(callback);
    }

    var module = this;

    return new Promise(function(resolve, reject) {
        debug('require %j', module.filename);

        module.exports = require(module.filename);

        resolve(module.exports);
    }).nodeify(callback);
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

function match(value, filter) {
    if (!filter) {
        return true;
    } else if (typeof filter === 'string') {
        // use minimatch?
        return value === filter;
    } else if (Array.isArray(filter)) {
        // use minimatch?
        return filter.indexOf(value) !== -1;
    }
}

//  _____                       _
// | ____|_  ___ __   ___  _ __| |_ ___
// |  _| \ \/ / '_ \ / _ \| '__| __/ __|
// | |___ >  <| |_) | (_) | |  | |_\__ \
// |_____/_/\_\ .__/ \___/|_|   \__|___/
//            |_|

module.exports = new Catalog(path.resolve(path.dirname(require.main && require.main.filename)));

module.exports.Catalog = Catalog;
module.exports.Package = Package;
module.exports.Module = Module;
