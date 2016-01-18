'use strict';

/**
 * Add resources such as icons and splash-screens to your Cordova project.
 *
 * @author David Alexander      <david@cerebralfix.com.com>
 * @since  18 January 2016
 */

// module dependencies
var path = require('path'),
    fs = require('fs'),
    through = require('through2'),
    gutil = require('gulp-util'),
    Q = require('q'),
    sizeOf = require('image-size'),
    mkdirp = require('mkdirp'),
    cordovaLib = require('cordova-lib').cordova,
    Config = require('cordova-config'),
    streamToPromise = require('stream-to-promise'),
    cordova = cordovaLib.raw;

function resourceAddingStream(stream, resourceType, options) {

    var cordovaFile = null;

    return through.obj(function(file, enc, cb) {
        // Change the working directory
        process.env.PWD = file.path;
        cordovaFile = file;

        cb();
    }, function(cb) {
        var xmlElements = [];
        var self = this;

        return streamToPromise(
            stream
                .pipe(through.obj(function(file, enc, cb) {
                    var dimensions = sizeOf(file.contents);
                    var extension = path.extname(file.relative);

                    var xmlElementName = (resourceType == "icons") ? "icon" : "splash";
                    var destinationPath = ((resourceType == "icons") ? ("res/icon/icon-" + dimensions.width) : ("res/splash/ios/" + dimensions.width + "x" + dimensions.height)) + extension;

                    xmlElements.push('<' + xmlElementName + ' src="' + destinationPath + '" width="' + dimensions.width + '" height="' + dimensions.height + '" />');

                    mkdir(path.join(cordovaFile.path, path.dirname(destinationPath)));
                    fs.writeFile(path.join(cordovaFile.path, destinationPath), file.contents, cb);
                }))
        )
        .then(function() {
            var config = new Config(path.join(cordovaFile.path, 'config.xml'));

            // Add the iOS platform element if it doesn't already exist.
            config.addRawXML('<platform name="ios" />', '/widget', '/widget/platform[@name="ios"]');

            for (var i = 0; i < xmlElements.length; i++)
            {
                var xmlElement = xmlElements[i];
                config.addRawXML(xmlElement, '/widget/platform[@name="ios"]');
            }

            return config.write();
        })
        .then(function() {
            // Pipe the file to the next step
            self.push(cordovaFile);
        })
        .then(cb).catch(function(err) {
            // Return an error if something happened
            cb(new gutil.PluginError('gulp-cordova-resources', err.message));
        });
    });
}

// export the module
module.exports = {
    icons: function(stream, options) {
        return resourceAddingStream(stream, 'icons', options);
    },

    splashScreens: function(stream, options) {
        return resourceAddingStream(stream, 'splashScreens', options);
    }    
};

/**
 * Conditional mkdir. If the file does not exist, it will create the directory, otherwise
 * it will not create the directory.
 *
 * From https://github.com/SamVerschueren/gulp-cordova-icon/blob/master/index.js
 */
function mkdir(dir) {
    if (!fs.existsSync(dir)) {
        mkdirp.sync(dir);
    }

    return dir;
}