

// TODO: Provision PHP & NodeJS on various platforms.

/*

Digital Ocean 
OpenShift
AWS S3 + Ubuntu


Generates installation files for local execution to
install in a remote environment and files that can
be executed in the remote environment.


i.e. combine pio.server with bash.origin and php+apache docker image provisioning.

Need to be able to install extensions and configure php and apache.

Later: Also need nginx installed to proxy apache so we can proxy to nodejs directly.

And in front of all this sits a nodejs server proxying all requests (pio.proxy).

IPs for sub-services can be made public (i.e. bind on public port by setting visibility or something to public network).

*/


exports.for = function (API) {

	const SSH = require("./ssh").for(API);


	var exports = {};


	function makeAPI (resolvedConfig) {

		var exports = {};

	    exports.runRemoteCommands = function (commands, workingDirectory) {
			API.console.verbose(("Running remote commands '" + commands.join("; ") + "' in '" + workingDirectory + "'.").magenta);
	        function sshUpload() {
	            return SSH.runRemoteCommands({
	                targetUser: resolvedConfig.ssh.user,
	                targetHostname: resolvedConfig.ssh.host,
	                commands: commands,
	                workingDirectory: workingDirectory,
	                keyPath: resolvedConfig.ssh.keyPath,
	                timeout: 30
	            });
	        }
            return sshUpload();
	    }

	    return exports;
	}

	exports.resolve = function (resolver, config, previousResolvedConfig) {

		return resolver({}).then(function (resolvedConfig) {

			API.ASSERT.equal(typeof resolvedConfig.ssh.host, "string");
			API.ASSERT.equal(typeof resolvedConfig.ssh.keyPath, "string");
			resolvedConfig.ssh.user = resolvedConfig.ssh.user || "root";

			resolvedConfig.prefixPath = resolvedConfig.prefixPath || "/opt";
        	resolvedConfig.remoteDeployPath = resolvedConfig.prefixPath + "/services";

			resolvedConfig.status = (previousResolvedConfig && previousResolvedConfig.status) || "unknown";

			if (resolvedConfig.status === "provisioned") {
				API.console.verbose("Skip provisioning prerequisites as previous status is provisioned.");
				return resolvedConfig;
			}

			var api = makeAPI(resolvedConfig);

            function ensurePrerequisites(repeat) {
                function ensureGlobalPrerequisites() {
                    if (repeat) {
                        return API.Q.reject("Could not provision prerequisites on system!");
                    }
                    API.console.verbose("Ensuring global prerequisites");
                    return api.runRemoteCommands([
                        // Make sure our user can write to the default install directory.
                        "sudo chown -f " + resolvedConfig.ssh.user + ":" + resolvedConfig.ssh.user + " " + resolvedConfig.prefixPath,
                        // Make sure some default directories exist
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/bin" ]; then mkdir ' + resolvedConfig.prefixPath + '/bin; fi',
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/cache" ]; then mkdir ' + resolvedConfig.prefixPath + '/cache; fi',
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/data" ]; then mkdir ' + resolvedConfig.prefixPath + '/data; fi',
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/tmp" ]; then mkdir ' + resolvedConfig.prefixPath + '/tmp; fi',
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/log" ]; then mkdir ' + resolvedConfig.prefixPath + '/log; fi',
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/run" ]; then mkdir ' + resolvedConfig.prefixPath + '/run; fi',
                        'if [ ! -d "' + resolvedConfig.prefixPath + '/services" ]; then mkdir ' + resolvedConfig.prefixPath + '/services; fi',
                        // Put `<prefix>/bin` onto system-wide PATH.
                        'if [ ! -f "/etc/profile.d/io.devcomp.vm.sh" ]; then',
                        '  sudo touch /etc/profile.d/io.devcomp.vm.sh',
                        "  sudo chown -f " + resolvedConfig.ssh.user + ":" + resolvedConfig.ssh.user + " /etc/profile.d/io.devcomp.vm.sh",
                        // TODO: Get `pio._config.env.PATH` from `state["pio"].env`.
                        '  echo "source \"' + resolvedConfig.prefixPath + '/bin/activate\"" > /etc/profile.d/io.devcomp.vm.sh',
                        '  sudo chown root:root /etc/profile.d/io.devcomp.vm.sh',
                        'fi',
                        'if [ ! -f "' + resolvedConfig.prefixPath + '/bin/activate" ]; then',
                        '  echo "#!/bin/sh -e\nexport PATH=' + resolvedConfig.prefixPath + '/bin:$PATH\n" > ' + resolvedConfig.prefixPath + '/bin/activate',
                        "  sudo chown -f " + resolvedConfig.ssh.user + ":" + resolvedConfig.ssh.user + " " + resolvedConfig.prefixPath + '/bin/activate',
                        'fi',
                        "sudo chown -f " + resolvedConfig.ssh.user + ":" + resolvedConfig.ssh.user + " " + resolvedConfig.prefixPath + '/*',
                        // NOTE: When deploying as root we need to give the group write access to allow other processes to access the files.
                        // TODO: Narrow down file access by using different users and groups for different services depending on their relationships.
                        "sudo chmod -Rf g+wx " + resolvedConfig.prefixPath
                    ], "/").then(function() {
                        return ensurePrerequisites(true);
                    });
                }
                return api.runRemoteCommands([
                    'if [ ! -f /etc/profile.d/io.devcomp.vm.sh ]; then echo "[pio:trigger-ensure-prerequisites]"; fi'
                ], resolvedConfig.prefixPath).then(function(response) {
                    if (/\[pio:trigger-ensure-prerequisites\]/.test(response.stdout)) {
                        return ensureGlobalPrerequisites();
                    }
                });
            }

            return ensurePrerequisites().then(function () {

				resolvedConfig.status = "provisioned";

				return resolvedConfig;
            });
		});
	}

	exports.turn = function (resolvedConfig) {

		return API.Q.denodeify(function (callback) {

//console.log ("TURN DEVCOMP VM", resolvedConfig);

			return callback(null);
		})();
	}

	return exports;
}

