(function () {
  'use strict';

  /**
   * Install and configure webmin
   */
  var webmin = exports;

  var lib = require('../../../lib'),
    format = require('string-format'),
    _ = require('lodash'),
    path = require('path'),
    mkdirp = require('mkdirp').sync,
    rimraf = require('rimraf').sync,
    exec = require('execSync').exec,
    fs = require('fs');

  _.extend(webmin, lib.task, /** @exports webmin */ {

    /** @override */
    beforeInstall: function (options) {
      mkdirp('/srv/ssl');

      options.nginx.outkey = path.resolve('/srv/ssl/xtremote.key');
      options.nginx.outcrt = path.resolve('/srv/ssl/xtremote.crt');
      options.nginx.domain = 'localhost';

      options.sys.etcWebmin = path.resolve('/etc/webmin');
      options.sys.webminConfigFile = path.resolve(options.sys.etcWebmin, 'config');
      options.sys.webminCustomPath = path.resolve(options.sys.etcWebmin, 'custom');
      options.sys.webminCustomConfigFile = path.resolve(options.sys.webminCustomPath, 'config');
      options.sys.webminXtuplePath = path.resolve(options.sys.etcWebmin, 'xtuple');
    },

    /** @override */
    beforeTask: function (options) {
      mkdirp(options.sys.webminXtuplePath);
    },

    /** @override */
    executeTask: function (options) {
      var debFile = 'webmin_1.680_all.deb';
      // TODO if debian
      if (!fs.existsSync(path.resolve(debFile))) {
        exec('wget https://s3.amazonaws.com/com.xtuple.deploy-assets/'+ debFile);
      }
      exec('dpkg --install '+ debFile);

      webmin.deleteUnusedModules(options);
      webmin.writeConfiguration(options);
      webmin.installCustomCommands(options);
      webmin.installNginxSite(options);
    },

    /** @override */
    afterTask: function (options) {
      exec('service nginx reload');
      exec('service webmin restart');
    },

    /** @override */
    uninstall: function (options) {
      fs.unlinkSync(path.resolve(options.sys.webminXtuplePath, 'editions.menu'));
      fs.unlinkSync(path.resolve(options.sys.webminCustomPath, '1001.cmd'));
      fs.unlinkSync(path.resolve(options.sys.webminCustomPath, '1001.html'));
    },

    writeConfiguration: function (options) {
      fs.appendFileSync(options.sys.webminConfigFile, [
        'webprefix=/_manage',
        'webprefixnoredir=1',
        'referer=1'
      ].join('\n').trim());

      fs.writeFileSync(options.sys.webminCustomConfigFile, [
        'display_mode=1',
        'columns=1',
        'params_cmd=0',
        'params_file=0',
        'sort=desc',
        'height=',
        'width=',
        'wrap='
      ].join('\n').trim());
    },

    installCustomCommands: function (options) {
      options.xt.version = require('../../../package').version;

      fs.writeFileSync(
        path.resolve(options.sys.webminXtuplePath, 'editions.menu'),
        fs.readFileSync(path.resolve(__dirname, 'editions.menu'))
      );
      fs.writeFileSync(
        path.resolve(options.sys.webminCustomPath, '1001.cmd'),
        fs.readFileSync(path.resolve(__dirname, 'server-install-file.cmd')).toString().format(options)
      );
      fs.writeFileSync(
        path.resolve(options.sys.webminCustomPath, '1001.html'),
        fs.readFileSync(path.resolve(__dirname, 'server-install-file.html')).toString().format(options)
      );
    },

    installNginxSite: function (options) {
      if (!fs.existsSync(options.nginx.outcrt)) {
        require('../../nginx').ssl.generate(options);
      }

      // write site file
      options.nginx.availableSite = path.resolve('/etc/nginx/sites-available/webmin-site');
      options.nginx.enabledSite = path.resolve('/etc/nginx/sites-enabled/webmin-site');
      options.nginx.siteTemplateFile = path.resolve(__dirname, 'webmin-site');
      require('../../nginx').site.writeSiteConfig(options);
    },

    deleteUnusedModules: function (options) {
      var mod = '/usr/share/webmin';

      rimraf(path.resolve(mod, 'bind8')):
      rimraf(path.resolve(mod, 'burner')):
      rimraf(path.resolve(mod, 'pserver')):
      rimraf(path.resolve(mod, 'exim')):
      rimraf(path.resolve(mod, 'fetchmail')):
      rimraf(path.resolve(mod, 'file')):
      rimraf(path.resolve(mod, 'grub')):
      rimraf(path.resolve(mod, 'jabber')):
      rimraf(path.resolve(mod, 'krb5')):
      rimraf(path.resolve(mod, 'ldap-client')):
      rimraf(path.resolve(mod, 'ldap-server')):
      rimraf(path.resolve(mod, 'ldap-useradmin')):
      rimraf(path.resolve(mod, 'mysql')):
      rimraf(path.resolve(mod, 'postfix')):
      rimraf(path.resolve(mod, 'qmailadmin')):
      rimraf(path.resolve(mod, 'iscsi-client')):
      rimraf(path.resolve(mod, 'iscsi-server')):
      rimraf(path.resolve(mod, 'iscsi-target')):
      rimraf(path.resolve(mod, 'ajaxterm')):
      rimraf(path.resolve(mod, 'adsl-client')):
      rimraf(path.resolve(mod, 'apache')):
      rimraf(path.resolve(mod, 'htaccess-htpasswd')):
      rimraf(path.resolve(mod, 'cpan')):
      rimraf(path.resolve(mod, 'pap')):
      rimraf(path.resolve(mod, 'ppp-client')):
    }
  });

})();

