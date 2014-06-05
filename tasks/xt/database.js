var lib = require('xtuple-server-lib'),
  rimraf = require('rimraf'),
  _ = require('lodash'),
  exec = require('execSync').exec,
  path = require('path'),
  fs = require('fs');

/**
 * Aggregate info about the databases the installer has been directed to set
 * up.
 */
_.extend(exports, lib.task, /** @exports xtuple-server-xt-database */ {
  options: {
    version: {
      required: '<version>',
      description: 'xTuple Version'
    },
    name: {
      required: '<name>',
      description: 'Name of the installation',
      validate: function (arg) {
        if (/\d/.test(arg)) {
          throw new Error('xt.name cannot contain numbers');
        }

        return true;
      }
    },
    maindb: {
      optional: '[path]',
      description: 'Path to primary database .backup/.sql filename to use in production',
      validate: function (arg) {
        if (!fs.existsSync(path.resolve(arg))) {
          throw new Error('Invalid path for xt.maindb: '+ arg);
        }

        return true;
      }
    },
    edition: {
      optional: '[string]',
      description: 'The xTuple Edition to install',
      value: 'core'
    },
    demo: {
      optional: '[boolean]',
      description: 'Set to additionally install the demo databases',
      value: false
    },
    quickstart: {
      optional: '[boolean]',
      description: 'Set to additionally install the quickstart databases',
      value: false
    },
    adminpw: {
      optional: '[password]',
      description: 'Password for the database "admin" user for a new database'
    }
  },

  /** @override */
  beforeInstall: function (options) {
    var foundationPath = path.resolve(options.xt.usersrc, 'foundation-database'),
      databases = [ ],
      maindb_path;

    if (options.xt.demo) {
      databases.push({
        dbname: 'xtuple_demo',
        filename: path.resolve(foundationPath, 'postbooks_demo_data.sql'),
        foundation: true
      });
    }
    if (options.xt.quickstart) {
      databases.push({
        dbname: 'xtuple_quickstart',
        filename: path.resolve(foundationPath, 'quickstart_data.sql'),
        foundation: true
      });
    }

    // schedule main database file for installation
    if (!_.isEmpty(options.xt.maindb)) {
      maindb_path = path.resolve(options.xt.maindb);
      if (fs.existsSync(maindb_path)) {
        databases.push({
          filename: maindb_path,
          dbname: options.xt.name + lib.util.getDatabaseNameSuffix(options),
          foundation: false
        });
      }
      else {
        throw new Error('Database File not found; expected to find '+ maindb_path);
      }
    }

    if (databases.length === 0) {
      throw new Error('No databases have been found for installation');
    }

    options.xt.database.list = databases;
  },

  /** @override */
  executeTask: function (options) {
    if (options.xt.database.list.length === 0) {
      throw new Error('No databases are scheduled to be installed');
    }

    exports.buildFoundationDatabases(options);
    exports.buildMainDatabases(options);
  },

  buildMainDatabases: function (options) {
    var xt = options.xt,
      extensions = lib.build.editions[xt.edition],
      databases = _.where(xt.database.list, { foundation: false });

    // build the main database, if specified
    _.each(databases, function (db) {
      rimraf.sync(path.resolve(options.xt.usersrc, 'scripts/lib/build'));

      var buildResult = exec(lib.build.getCoreBuildCommand(db, options));
      if (buildResult.code !== 0) {
        throw new Error(buildResult.stdout);
      }

      // install extensions specified by the edition
      _.each(extensions, function (ext) {
        var result = exec(lib.build.getExtensionBuildCommand(db, options, ext));
        if (result.code !== 0) {
          throw new Error(result.stdout);
        }
      });
    });
  },

  buildFoundationDatabases: function (options) {
    var quickstart = _.findWhere(options.xt.database.list, { dbname: 'xtuple_quickstart' }),
      demo = _.findWhere(options.xt.database.list, { dbname: 'xtuple_demo' }),
      qsBuild, demoBuild;

    rimraf.sync(path.resolve(options.xt.usersrc, 'scripts/lib/build'));
    if (quickstart) {
      qsBuild = exec(lib.build.getSourceBuildCommand(quickstart, options));

      if (qsBuild.code !== 0) {
        throw new Error(JSON.stringify(qsBuild));
      }
    }
    if (demo) {
      demoBuild = exec(lib.build.getSourceBuildCommand(demo, options));

      if (demoBuild.code !== 0) {
        throw new Error(JSON.stringify(demoBuild));
      }
    }
  }
});
