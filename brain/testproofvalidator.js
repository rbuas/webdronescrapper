var _fs = require("fs");
var _pixelmatch = require("pixelmatch");
var _resemble = require("node-resemble-js");
var _glob = require("glob");
var _prompt = require("prompt-sync")();
var _log = require("./log");
var PNG = require("pngjs").PNG;

module.exports.TestProofValidator = TestProofValidator;


var _defaultoptions = {
    path : __dirname + "/../tests/proof/",
    imageproof : ".proof", 
    imagediff : ".diff"
};

function TestProofValidator (options) {
    var self = this;
    self.options = Object.assign(_defaultoptions, options) || {};
    self.proofindex = 0;
    self.proofdiff = [];
    readLogs(self);
}



//PRIVATE

function readDiffs (diffs) {
    if(!diffs)
        return;

    var newdiff = [];
    for(var d in diffs) {
        if(!diffs.hasOwnProperty(d)) continue;

        var diff = diffs[d];
        if(!validateDiff(diff.truth, diff.proof, diff.diff))
            newdiff.push(diff);
    }
    return newdiff;
}

function validateDiff (truth, proof, diff) {
    var replace = getUserOption(truth, proof);
    if(replace == "y") {// so the good one is proof
        removeProof(truth);
        removeProof(diff);
        renameProof(proof, truth);
        return true;
    } else {// so error will keep
        return false;
    }
}

function getUserOption (truth, proof, callback) {
    var message = 'Is there a new truth ? We should replace the new proof as the truth (' + truth + ' -> ' + proof + ') ? (y/n)';
    var replace = _prompt(message);
    return replace;
}

function readLogs (self) {
    if(!self)
        return;

    var list = getLogFiles(self.options.path);
    for(l in list) {
        if (!list.hasOwnProperty(l)) continue;

        var logfile = list[l];
        var logcontent = readLog(logfile);
        if(!logcontent || logcontent.status == "OK")
            continue;

        var newdiff = readDiffs(logcontent.diff);
        logcontent.status = newdiff.length > 0 ? "DIFF" : "OK",
        logcontent.diff = newdiff;
        logcontent.diffcount = newdiff.length;
        saveLog(logfile, logcontent);
    }
}

function removeProof (file) {
    if(!_fs.existsSync(file))
        return false;

    _fs.unlink(file);
    return true;
}

function renameProof (oldfile, newfile) {
    if(!_fs.existsSync(oldfile))
        return false;

    _fs.renameSync(oldfile, newfile);
    return true;
}

function getLogFiles (dir) {
    dir = dir || ".";
    var files = _glob.sync(dir + "*.log", {});
    return files;
}

function readLog (filename) {
    var logcontent = _fs.readFileSync(filename);
    return JSON.parse(logcontent);
}

function saveLog (filename, log) {
    var logcontent = JSON.stringify(log);
    _fs.writeFileSync(filename, logcontent);
}

var newvalidator = new TestProofValidator();
