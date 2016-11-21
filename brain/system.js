var _fs = require("fs");
var _util = require("util");

module.exports = System = {};

System.errorconfig = {};
System.messageconfig = {};

/**
 * registerErrors
 * @param errorconfig table ERROR_CODE : ERROR_DESCRIPTION
 */
System.registerErrors = function (errorconfig) {
    System.errorconfig = Object.assign(System.errorconfig, errorconfig);
    var objDefs = {};
    for(var e in errorconfig) {
        if(!errorconfig.hasOwnProperty(e)) continue;

        objDefs[e] = e;
    }
    return objDefs;
}


/**
 * registerMessages
 * @param messageconfig table MESSAGE_CODE : MESSAGE_DESCRIPTION
 */
System.registerMessages = function (messageconfig) {
    System.messageconfig = Object.assign(System.messageconfig, messageconfig);
    var objDefs = {};
    for(var e in messageconfig) {
        if(!messageconfig.hasOwnProperty(e)) continue;

        objDefs[e] = e;
    }
    return objDefs;
}


/**
 * error
 * @param code string ERROR_CODE
 * @param detail string ERROR_DESCRIPTION
 */
System.error = function (code, detail) {
    var error = System.errorconfig[code];
    var message = error || "";
    if(detail)
        message += "(" + _util.inspect(detail) + ")";

    return {code:code, detail:message};
}

/**
 * version Returns de version object registered in file version.json 
 */
System.version = function() {
    var version = JSON.parse(_fs.readFileSync('version.json', 'utf8'));
    return version;
}

/**
 * call callback if it exists
 */
System.callback = function(callback, args) {
    if(!callback)
        return;

    return callback.apply(null, args || []);
}