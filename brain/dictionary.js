var _fs = require("fs");

var Log = require(ROOT_DIR + "/brain/log");
var JsExt = require(ROOT_DIR + "/brain/jsext");
var System = require(ROOT_DIR + "/brain/system");
var E = System.error;


module.exports = Dictionary = {};

Dictionary.data = {};

Dictionary.ERROR = System.registerErrors({});

Dictionary.load = function (file) {
    if(!file)
        return;

    var filecontent = _fs.readFileSync(file, 'utf8');
    if(!filecontent)
        return;

    var fileobject = JSON.parse(filecontent);
    if(!fileobject)
        return;

    Dictionary.data = Object.assign(Dictionary.data, fileobject);
}

Dictionary.get = function(key, lang) {
    if(!key)
        return;

    var keyDic = Dictionary.data[key];
    if(!keyDic)
        return key;

    if(typeof(keyDic) == "string")
        return keyDic;

    var keyTrad = lang && keyDic[lang] && keyDic[lang] && JsExt.first(keyDic) || key;
    return keyTrad;
}

Dictionary.load(ROOT_DIR + "/common.json");