'use strict';
const chokidar = require('chokidar');
const shs = require('static-http-server');
const build = require('./build');

const chalk = require('chalk');
const async = require('async');
const _ = require('lodash');
const utils = require('../lib/utils');

function colorType(str) {
    switch(str) {
        case 'CHANGE':
            return chalk.green(str);
        case 'ADD':
            return chalk.yellow('---' + str);
        case 'UNLINK':
            return chalk.red(str);
        case 'UNLINKDIR':
            return chalk.red(str);
        default:
            return chalk.gray(str);
    };
}

function log(e, rPath) {
    console.log('[%s] => %s', colorType(e.toUpperCase()), colorType(utils.relativeDir(rPath)));
}

function server(config, callback) {
    callback = callback || function() {};

    shs(config._SERVER_ROOT, {
        nolog: config.nolog,
        index: config.server.index,
        port: config.server.port
    }, callback);
}

function handleWatchEvent(callback) {
    return function(event, path) {
        log(event, path);
        if (event !== 'unlink' && utils.isNormalFile(path)) {
            callback(path);
        }
    };
}

function watch(config, callback){
    callback = callback || function() {};

    config.watcher = chokidar.watch(config._SOURCE_ROOT, {
        ignored: config.watchIgnore,
        ignoreInitial: true
    }).on('all', handleWatchEvent(function (path) {
        build(config, path);
    }));

    chokidar.watch(config.templateRefs, {
        ignoreInitial: true
    }).on('all', handleWatchEvent(function () {
        build(config, config.templates[0]);
    }));

    callback(null);
}
function watchRefs(config) {
    var result = _.transform(config._sass, (result, values, key) => {
        values.forEach(function (value) {
            if (!result[value]) {
                result[value] = [];
            }

            result[value].push(key);
        });
    });

    function watch(tar, des) {
        config.watcher.unwatch(tar);
        chokidar.watch(tar, {
            ignored: config.watchIgnore,
            ignoreInitial: true
        }).on('all', handleWatchEvent(function () {
            build(config, des.concat(tar));
        }));
    }

    for ( var key in result ) {
        if ( result.hasOwnProperty(key) ) {
            watch(key, result[key]);
        }
    }
}

module.exports = function(config, callback) {
    callback = callback || function() {};

    async.series([
        cb => build(config, null, cb),
        cb => server(config, cb),
        cb => watch(config, cb)
    ], function (err) {
        if (err) {
            console.error(err);
        }

        watchRefs(config);
        callback();
    });
};
