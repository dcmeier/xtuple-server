var lib = require('xtuple-server-lib'),
  exec = require('child_process').execSync,
  _ = require('lodash'),
  path = require('path'),
  fs = require('fs'),
  global_policy_filename = 'XT00-xtuple-global-policy',
  user_policy_filename = 'XT10-xtuple-user-policy',
  sudoers_d = path.resolve('/etc/sudoers.d');

/**
 * Setup machine access policies.
 */
_.extend(exports, lib.task, /** @exports xtuple-server-sys-policy */ {

  /** @override */
  beforeTask: function (options) {
    //localPolicy.beforeTask(options);

    if (options.planName === 'setup') {
      options.sys.policy.remotePassword = lib.util.getPassword();
    }
    else {
      try {
        exec('id -u' + options.xt.name);
      }
      catch (e) {
        if (options.xt && !_.isEmpty(options.xt.name)) {
          options.sys.policy.userPassword = lib.util.getPassword();
        }
      }
    }
  },

  /** @override */
  executeTask: function (options) {
    if (options.planName === 'setup') {
      exports.createSystemPolicy(options);
    }
    else {
      exports.createUserPolicy(options);
    }
  },

  /** @override */
  afterInstall: function (options) {
    exec('rm -f ~/.pgpass');
    exec('rm -f ~/.bash_history');
    exec('rm -f /root/.bash_history');

    //exec('chmod a-w {xt.configdir}/install-arguments.json'.format(options));
    //exec('chmod a-w {xt.configdir}/install-results.json'.format(options));
  },

  /** @override */
  afterTask: function (options) {
    exec('chmod 440 /etc/sudoers.d/*');

    // validate sudoers files
    exec('visudo -c');
  },

  /** @private */
  createSystemPolicy: function (options) {
    var global_policy_src = fs.readFileSync(path.resolve(__dirname, global_policy_filename)).toString(),
      global_policy_target = path.resolve(sudoers_d, global_policy_filename),
      system_users = [
        'addgroup xtuser',
        'addgroup xtadmin',
        'useradd xtremote -d /usr/local/xtremote -p {sys.policy.remotePassword}'.format(options),
        'adduser xtadmin --disabled-login',
        'usermod -a -G xtadmin,xtuser,www-data,postgres,lpadmin,ssl-cert xtremote',
        'usermod -a -G ssl-cert,xtuser,www-data postgres',
      ],
      system_ownership = [
        'chown -R :xtuser /etc/xtuple',
        'chown -R :xtuser /var/log/xtuple',
        'chown -R :xtuser /var/lib/xtuple',
        'chown -R :xtuser /usr/sbin/xtuple',
        'chown -R :xtuser /usr/local/xtuple',
        'chown -R postgres:xtuser /var/run/postgresql'
      ],
      system_mode = [
        'chmod -R g=x,o-wr /etc/xtuple/',
        'chmod -R g=rx,u=rwx,o-wr /var/lib/xtuple',
        'chmod -R g=rx,u=rwx,o=rx /usr/sbin/xtuple',
        'chmod -R g=rx,u=rwx,o=rx /usr/local/xtuple',
        'chmod -R g+wrx /var/run/postgresql'
      ],
      visudo_cmd;

    // create system users
    if (options.sys.policy.remotePassword) {

      // set xtremote shell to bash
      exec('sudo chsh -s /bin/bash xtremote');
      _.map(_.flatten([ system_users, system_ownership, system_mode ]), function (cmd) {
        try {
          exec(cmd, { stdio: 'ignore' });
        }
        catch (e) {
          //log.warn('sys-policy', e.message.trim().split('\n')[1]);
          log.verbose('sys-policy', e.stack.split('\n'));
        }
      });
    }

    // write sudoers file
    if (!fs.existsSync(global_policy_target)) {
      fs.writeFileSync(global_policy_target, global_policy_src);
    }
  },

  /** @private */
  createUserPolicy: function (options) {
    var user_policy_src = fs.readFileSync(path.resolve(__dirname, user_policy_filename)).toString(),
      user_policy_target = path.resolve(
        sudoers_d,
        user_policy_filename.replace('user', '{xt.name}').format(options)
      ),
      xtuple_users = [
        'useradd {xt.name} -d /usr/local/{xt.name} -p {sys.policy.userPassword}'.format(options),
        'usermod -a -G postgres,xtuser {xt.name}'.format(options),
        'chage -d 0 {xt.name}'.format(options)
      ],
      user_ownership = [
        'chown -R :xtuser {pg.logdir}'.format(options),
        'chown -R {xt.name}:xtuser /usr/local/{xt.name}'.format(options),
        'chown -R {xt.name}:xtuser {xt.logdir}'.format(options),
        'chown -R {xt.name}:xtuser {xt.configdir}'.format(options),
        'chown -R {xt.name}:xtuser {xt.statedir}'.format(options),
        'chown -R {xt.name}:xtuser {xt.rundir}'.format(options),
        'chown -R {xt.name}:ssl-cert {xt.ssldir}'.format(options),
        'chown -R {xt.name}:{xt.name} {xt.userhome}'.format(options),
        'chown -R {xt.name}:{xt.name} {xt.userconfig}'.format(options)
      ],
      user_mode = [
        'chmod -R u=rwx /usr/local/{xt.name}'.format(options),
        'chmod -R u=rwx,g=wx {xt.logdir}'.format(options),
        'chmod -R u=rwx,g=wx {pg.logdir}'.format(options),
        'chmod -R u=rwx,g-rwx {xt.statedir}'.format(options),
        'chmod -R g=rx,u=wrx,o-rwx {xt.ssldir}'.format(options),
        'chmod -R g=rwx,u=wrx,o-rw {xt.configdir}'.format(options)
      ];

    // create *this* user, and set access rules
    if (options.sys.policy.userPassword) {
      _.map(_.flatten([ xtuple_users, user_ownership, user_mode ]), function (cmd) {
        console.log(cmd);
        try {
          exec(cmd, { stdio: 'ignore' });
        }
        catch (e) {
          //log.warn('sys-policy', e.message.trim().split('\n')[1]);
          log.verbose('sys-policy', e.stack.split('\n'));
        }
      });
    }

    // write sudoers file for user
    if (!fs.existsSync(user_policy_target)) {
      fs.writeFileSync(user_policy_target, user_policy_src.format(options));
    }

    // set user shell to bash
    exec('sudo chsh -s /bin/bash/' + options.xt.name);
  },

  /** @override */
  uninstall: function (options) {
    /*
    if (!_.isEmpty(options.xt.name)) {
      //exec('skill -KILL -u {xt.name}'.format(options));
    }
    */
  }
});
