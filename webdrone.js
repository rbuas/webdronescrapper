var _expect = require("chai").expect;
var _assert = require("chai").assert;
var _should = require("chai").should();
var _url = require("url");

global.ROOT_DIR = __dirname;
var Log = require(ROOT_DIR + "/brain/log");
var WebDroneScraper = require(ROOT_DIR + "/brain/webdronescraper");
var Memory = require(ROOT_DIR + "/brain/memory");
var Wap = require(ROOT_DIR + "/models/wap");
global.PROCESSARGS = {};

function testPage (data, stats) {
    _expect(data).to.be.ok;
    _expect(stats).to.be.ok;
    _expect(stats.statusCode).to.be.equal(200);
    _expect(stats.loadDuration).to.be.below(5000);
    _expect(stats.contentLength).to.be.below(500000);
    _expect(stats.metadescription).to.be.ok;
    _expect(stats.metadescription).to.not.be.equal("");
    _expect(stats.canonical).to.be.ok;
    _expect(stats.canonical).to.not.be.equal("");
    //_expect(stats.gtm).to.be.ok;
    //_expect(stats.gtm).to.not.be.equal("");
    var canonicalParsed = _url.parse(stats.canonical);
    _expect(canonicalParsed).to.be.ok;
    _expect(canonicalParsed.path).to.be.equal(stats.path);
}

function scrapPage ($) {
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
}

function statsPage (data, stats) {
    Log.message("Stats: ", stats);
}

function getSitelink () {
    return PROCESSARGS["sitelink"];
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
            scrapCallback : scrapPage,
            eachCallback : testPage,
            endCallback : function (data, stats) {
                statsPage(data, stats);
                done();
            }
        });
    });
});