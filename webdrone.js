var _url = require("url");
var _fs = require("fs");
var _moment = require("moment");

global.ROOT_DIR = __dirname;
var Log = require(ROOT_DIR + "/brain/log");
var WebDroneScraper = require(ROOT_DIR + "/brain/webdronescraper");
var Memory = require(ROOT_DIR + "/brain/memory");
var Wap = require(ROOT_DIR + "/models/wap");
global.PROCESSARGS = null;

function statsPage (data, stats) {
    Log.message("Stats: ", stats);
}

function getSitelink () {
    if(!global.PROCESSARGS) getProcessParams();
    return PROCESSARGS["sitelink"];
}

function saveStatsToFile (err, data, callback) {
    if(err)
        return callback && callback();

    var outputFilename = "./stats/" + _moment().format('YYYYMMDDHHmm') + ".stat";
    _fs.writeFile(outputFilename, JSON.stringify(data, null, 3), function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("STATS saved to " + outputFilename);
        }
        return callback && callback();
    }); 
}

function getProcessParams () {
    global.PROCESSARGS = {};
    var args = process.argv.slice(2);
    args.forEach(function (val, index, array) {
        var argitem = val.replace("--", "");
        var argd = argitem.split("=");
        var key = argd && argd.length > 0 ? argd[0] : null;
        var value = argd && argd.length > 1 ? argd[1] : null;
        if(!key) return;

        PROCESSARGS[key] = value || true;
    });
}

// get sitelink parameter
var sitelink = getSitelink();

//start drone
var wdc = new WebDroneScraper();

//start drone memory
var m = new Memory();

//scrap crowler map
wdc.linksfile({
    mapfile : "/cms/crowlermap.json",
    hostname : sitelink,
    port : 80,
    loadcharge : 5,
    scrapCallback : function ($) { //READ PAGE
        if(!$) return;

        var titleinfo = $("h1");
        var canonical = $("link[rel='canonical']");
        var metadescription = $("meta[name='description']");
        var gtm = $("#gtm");
        return {
            title : titleinfo.text(),
            titleCount : titleinfo ? titleinfo.length : 0,
            canonical : canonical.attr("href"),
            metadescription : metadescription && metadescription.length > 0 && metadescription[0].attribs ? metadescription[0].attribs.content : null,
            gtm : gtm.text()
        };
    },
    eachCallback : function (stat, index, loadstats) { //TEST PAGE
        if(!stat)
            return stat;

        //STATUS : OK (initial)
        stat.status = Wap.STATUS.OK;

        var canonicalParsed = stat.canonical && _url.parse(stat.canonical);

        //STATUS : WARNING
        var warning = stat.loadDuration > 5000
                        //|| !stat.gtm
                        || stat.contentLength > 500000;
        if(warning) stat.status = Wap.STATUS.WARNING;

        //STATUS : ERROR
        var error = stat.statusCode != 200
                        || !stat.metadescription
                        || !stat.canonical
                        || !canonicalParsed
                        || canonicalParsed.path != stat.path;

        if(error) stat.status = Wap.STATUS.ERROR; 

        return stat;
    },
    endCallback : function (stats) {
        Wap.GetStats({}, function (err, stats) {
            saveStatsToFile(err, stats, function() {
                m.disconnect();
            });
        });

    }
});