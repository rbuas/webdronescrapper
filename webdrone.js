var _expect = require("chai").expect;
var _assert = require("chai").assert;
var _should = require("chai").should();
var _url = require("url");
var _fs = require("fs");
var _moment = require("moment");

global.ROOT_DIR = __dirname;
var Log = require(ROOT_DIR + "/brain/log");
var WebDroneScraper = require(ROOT_DIR + "/brain/webdronescraper");
var Memory = require(ROOT_DIR + "/brain/memory");
var Wap = require(ROOT_DIR + "/models/wap");
global.PROCESSARGS = {};

function statsPage (data, stats) {
    Log.message("Stats: ", stats);
}

function getSitelink () {
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

describe("load.sitemap", function() {
    var m, wdc, sitelink;

    before(function(done) {
        // get sitelink parameter
        getProcessParams();
        sitelink = getSitelink();
        _expect(sitelink).to.be.ok;

        //start drone
        wdc = new WebDroneScraper();

        //start drone memory
        m = new Memory({onconnect:done});
    });

    after(function(done) {
        m.disconnect(done);
    });

    it("filemap", function(done) {
        wdc.linksfile({
            mapfile : "/cms/crowlermap.json",
            hostname : sitelink,
            port : 80,
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
            eachCallback : function (data, stats) { //TEST PAGE
                if(!data || !stats)
                    return stats;

                //STATUS : OK (initial)
                stats.status = Wap.STATUS.OK;

                var canonicalParsed = stats.canonical && _url.parse(stats.canonical);

                //STATUS : WARNING
                var warning = stats.loadDuration > 5000
                                //|| !stats.gtm
                                || stats.contentLength > 500000;
                if(warning) stats.status = Wap.STATUS.WARNING;

                //STATUS : ERROR
                var error = stats.statusCode != 200
                                || !stats.metadescription
                                || !stats.canonical
                                || !canonicalParsed
                                || canonicalParsed.path != stats.path;
                if(error) stats.status = Wap.STATUS.ERROR; 
                
                _expect(error).to.be.equal(false);

                return stats;
            },
            endCallback : function (data, stats) {
                Wap.GetStats({}, function (err, stats) {
                    saveStatsToFile(err, stats, done);
                });
            }
        });
    });
});