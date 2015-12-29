'use strict';

var LAMPApp = require('./LAMPApp');

class WordpressApp extends LAMPApp {


  /**
   * Options (used by this task):
   *   @param {object} container - An instantiated and configured Container object.
   *   @param {object} options - A hash of configuration options specific to this task.
   *   @param {string} options.devDomain - The url of the dev site. This is replaced by the probo url in the db.
   *   @param {string} options.devHome - The homepage url of the dev site (including the domain). This is replaced by
   *      the probo url in the db.
   *   @param {string} options.database - The filename of the database to import if specified. Note that this database
   *      *must be added to the assets array separately*.
   *   @param {string} [options.databaseName] - The name of the database. Defaults to 'wordpress'.
   *   @param {boolean} [options.databaseGzipped] - Whether the database was sent gzipped and whether it should therefore
   *      be gunzipped before importing.
   *   @param {string} [options.subDirectory] - The directory of the actual web root (defaults to 'docroot').
   *   @param {boolean} [options.flushCaches] - Whether to flush the cache.
   */
  constructor(container, options) {
    super(container, options);
    this.databaseName = options.databaseName || 'wordpress';

    this.options.siteFolder = options.siteFolder || 'default';
    this.options.profileName = options.profileName || 'standard';
    this.options.flushCaches = (options.flushCaches || typeof options.flushCaches === 'undefined');
    this.options.devHome = options.devHome;
    this.options.devDomain = options.devDomain;
    // TODO: Add some kind of validation.

    // Filter out secret strings
    options.secrets = [
    ];

    // Allow for subdirectory to be explicitly set to "" without being overwritten for being falsy.
    this.subDirectory = options.subDirectory || 'docroot';
    this.script = [];
    this.populateScriptArray();
    this.setScript(this.script);

  }

  description() {
    return `${this.plugin} 'Provisioning WordPress!'`;
  }

  /**
   *
   */
  populateScriptArray() {
    this.addScriptHeader();
    this.addScriptSymlinks();
    this.addScriptCreateDatbase();
    this.addScriptImportDatabase();
    this.addScriptAppendWPConfigSettings();
    this.addScriptReplaceDomain();
    if (this.options.flushCaches) {
      this.addScriptFlushCaches();
    }
  }

  addScriptAppendWPConfigSettings() {
    this.script = this.script.concat([
      // get the last instance of wp-settings.php. Get the last one because some versions of WP reference this file in a comment.
      'WP_CONFIG_LINE_NUMBER=$(grep -n \'wp-settings.php\' wp-config.php | gawk \'{print $1}\' FS=\':\' | tail -n1\')',

      // overwrite any previously defined variables by inserting new values before
      'PHP_SNIPPET=$(cat <<END_HEREDOC',
      'define("DB_NAME", "wordpress");',
      'define("DB_USER", "root");',
      'define("DB_USER", "strongpassword");',
      'define("DB_HOST", "localhost");',
      'define("DB_CHARSET", "utf8");',
      'define("DB_COLLATE", "");',
      'END_HEREDOC',
      ')',

      // create a wp-config file if needed and insert the snippet at the correct line number
      'if [ ! -a "/var/www/html/wp-config.php" ] ; then',
      '  cp /var/www/html/wp-config-sample.php /var/www/html/wp-config.php',
      'fi',
      'sed -i \'$(WP_CONFIG_LINE_NUMBER)i $(PHP_SNIPPET)\' /var/www/html/wp-config.php',
    ]);
  }

  addScriptRunInstall() {
    var installArgs = this.options.installArgs || '';
    this.script.push(`drush site-install --root=/var/www/html ${this.options.profileName} ${installArgs}`);
  }

  addScriptUpdatePlugins() {
    this.script.push('cd $SRC_DIR ; wp plugin update');
  }

  addScriptFlushCaches() {
    this.script.push('cd $SRC_DIR ; wp cache flush');
  }

  addScriptReplaceDomain() {
    // flatten home page url first, so that it points to probo root
    this.script.push(`export DEV_HOME=${this.options.devHome}`);
    this.script.push(`export DEV_DOMAIN=${this.options.devDomain}`);
    this.script.push(this.replaceOption('$BUILD_DOMAIN', 'home'));
    this.script.push(this.replaceTextDb('$DEV_HOME', '$BUILD_DOMAIN'));

    this.script.push(this.replaceOption('$BUILD_DOMAIN', 'siteurl'));
    this.script.push(this.replaceTextDb('$DEV_DOMAIN', '$BUILD_DOMAIN'));
  }

  replaceOption(updated, option) {
    var command = `cd $SRC_DIR/${this.subDirectory} ; wp option update ${option} ${updated} `;
    return command;
  }

  replaceTextDb(orig, updated) {
    var command = `cd $SRC_DIR/${this.subDirectory} ; wp search-replace '${orig}' '${updated}' --skip-columns=guid`;
    return command;
  }

  /*
  @TODO in general settings, change the following:
    - change .htaccess file to match new permalinks location
    */
};

module.exports = WordpressApp