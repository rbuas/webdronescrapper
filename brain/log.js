var _chalk = require("chalk");
var _util = require("util");

module.exports = Log = {};

Log.error = function(message, obj) {
    var line = _chalk.bold.red("ERROR : ") + _chalk.red(message);
    Log.message(line, obj);
}

Log.warning = function(message, obj) {
    var line = _chalk.bold.yellow("ERROR : ") + _chalk.yellow(message);
    Log.message(line, obj);
}

Log.success = function(message, obj) {
    var line = _chalk.bold.green("OK : ") + _chalk.green(message);
    Log.message(line, obj);
}

Log.assert = function(condition, message, obj) {
    if(condition)
        return;
    return Log.error(message, obj);
}

Log.message = function(message, obj, color) {
    var line = colorize(message, color);
    if(obj)
        console.log(line, colorize(dump(obj), color));
    else
        console.log(line);
}

Log.trace = function(message, obj) {
    Log.message(message, obj);
    //TODO save it into file trace.log
}

Log.section = function (message) {
    var line = _chalk.bgBlack.white("SECTION - " + message);
    Log.message(line);
}



// PRIVATE

function dump (obj) {
    return _util.inspect(obj, {depth:null});
}

function colorize (text, color) {
    if(!color || !text)
        return text;

    var colorFunc = _chalk[color];
    if(!colorFunc)
        return text;

    return colorFunc(text);
}