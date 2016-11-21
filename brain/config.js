var _fs = require("fs");

var Log = require(ROOT_DIR + "/brain/log");
var JsExt = require(ROOT_DIR + "/brain/jsext");
var System = require(ROOT_DIR + "/brain/system");
var E = System.error;


module.exports = Config = {};

Config.data = {};

Config.ERROR = System.registerErrors({});

Config.load = function (file) {
    if(!file)
        return;

    var filecontent = _fs.readFileSync(file, 'utf8');
    if(!filecontent)
        return;

    var fileobject = JSON.parse(filecontent);
    if(!fileobject)
        return;

    Config.data = Object.assign(Config.data, fileobject);
}

Config.get = function(key) {
    if(!key)
        return;

    var value = Config.data[key] || key;
    return value;
}

Config.load(ROOT_DIR + "/config.json");