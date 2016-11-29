var _http = require("http");
var _cheerio = require("cheerio");
var _querystring = require("querystring");
var _url = require("url");

var Log = require(ROOT_DIR + "/brain/log");
var JsExt = require(ROOT_DIR + "/brain/jsext");
var System = require(ROOT_DIR + "/brain/system");
var Wap = require(ROOT_DIR + "/models/wap");
var E = System.error;

module.exports = WebDroneScraper;

function WebDroneScraper (options) {
    var self = this;

    self.options = Object.assign(WebDroneScraper.defaultoptions, options) || {};

    self.stats = {};
}

WebDroneScraper.defaultoptions = {
    //mapfile : String,
    //hostname : String,
    //port : Number,
    //eachCallback : callback (data, stats),
    //endCallback : callback (data, stats),
    //updateStats : callback (newstats, stats),
    //scrapCallback : callback (data, stats)
};

WebDroneScraper.prototype.getStatsUrl = function (stats) {
    if(!stats)
        return;

    var url = stats.hostname || stats.host || "";
    if(stats.port) {
        url += ":" + stats.port;
    }
    url += stats.path;
    return url;
}

WebDroneScraper.prototype.request = function (options, callback) {
    var self = this;
    if(!options)
        return;

    var method = options.method || "GET";
    var path = options.path;
    var dataString = JSON.stringify(options.data);
    var info = {
        request : {
            method : method,
            //port : options.port || self.options.port,
            path : path || "/",
            hostname : options.hostname || self.options.urlbase,
            headers : {}
        }
    };
    if(method == "GET") {
        var querystring = _querystring.stringify(options.data);
        info.request.path = JsExt.buildUrl(path, querystring);
    } else if(method == "POST") {
        info.request.headers['Content-Type'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        info.request.headers['Connection'] = 'keep-alive';
        info.request.headers['Content-Length'] = dataString && dataString.length || 0;
        info.request.json = true;
    }

    if(options.keepsession) {
        if(options.sessionCookie) info.request.headers['Cookie'] = options.sessionCookie;
        info.request.headers["Connection"] = "keep-alive";
        info.request.agent = new _http.Agent({
            maxSockets: 1,
            timeout: 60000,
            keepAliveTimeout: 30000
        });
    }

    info.startTime = new Date();
    var request = _http.request(info.request, function(res) {
        var data = "";
        res.setEncoding('utf8');
        info.headers = res.headers;
        if(options.keepsession) {
            var cookie = res.headers["set-cookie"];
            options.sessionCookie = cookie && cookie.length > 0 && cookie[0];
        }
        res.on("data", function(d) {
            data += d;
        });
        res.on("end", function() {
            info.endTime = new Date();
            info.loadDuration = info.endTime - info.startTime;
            info.statusCode = this.statusCode;
            info.statusMessage = this.statusMessage;
            if(info.statusCode != 200) {
                var error = "status code error";
                if(callback) callback(error, info, null);
                return;
            }
            if(callback) callback(null, info, data);
        });
    }).on("error", function(error) {
        info.endTime = new Date();

        if(callback) callback(error, info, null);
    });

    if(dataString && method == "POST") {
        request.write(dataString);
    }

    request.end();
}

WebDroneScraper.prototype.scrapWap = function (wap, config, callback) {
    var self = this;
    if(!wap || !config)
        return callback && callback(null, null);

    var loadcharge = config.loadcharge || 1;
    var statsid = wap.path;
    self.stats[statsid] = self.stats[statsid] || startStats();
    var stats = self.stats[statsid];
    var pendding = loadcharge;

    for(var i = 0 ; i < loadcharge; i++) {
        var startTime = new Date();

        self.request({
                path:wap.path,
                port:wap.port || config.port,
                hostname:wap.hostname || config.hostname
            }, 
            function(err, reqinfo, data) {
                var newstats;
                if(!err && data) {
                    newstats = stockStats(self, stats, wap, config, reqinfo, getScrapInfos(self, config, data));
                    if(config.eachCallback) newstats = config.eachCallback(data, newstats);
                    if(newstats) sendUpdateStats(self, newstats);
                }

                if(--pendding == 0 && callback) callback(data, newstats);
            }
        );
    }
}

WebDroneScraper.prototype.scrap = function (list, config) {
    var self = this;
    if(!config)
        return;

    if(!list)
        return System.callback(config.endCallback);

    list = (list instanceof Array) ? list : [list];

    var pendding = list.length;

    for(var l in list) {
        if(!list.hasOwnProperty(l))
            continue;

        var wap = list[l];
        self.scrapWap(wap, config, function(data, newstats) {
            if(--pendding == 0 && config.endCallback) config.endCallback(data, newstats);
        });
    }
}

WebDroneScraper.prototype.sitemap = function (config) {
    var self = this;
    if(!config)
        return;

    if(!config.mapfile)
        return System.callback(config.endCallback);

    self.mapfile = config.mapfile;
    self.sitemap = require(self.mapfile);
    if(!self.sitemap) {
        Log.error("Can not load sitemap from : " + self.mapfile);
        return System.callback(config.endCallback);
    }

    var wapmap = [];
    for(var path in self.sitemap) {
        if(!self.sitemap.hasOwnProperty(path))
            continue;

        var wap = self.sitemap[path];
        wap.path = path;
        wapmap.push(wap);
    }

    if(wapmap.length == 0) {
        Log.message("No waps into wapmap");
        return System.callback(config.endCallback);
    }

    return self.scrap(wapmap, config);
}

WebDroneScraper.prototype.wapmap = function (config) {
    var self = this;
    if(!config)
        return;

    Wap.GetMap({}, function(err, wapmap) {
        if(!wapmap) {
            Log.error("Can not retrieve wapmap : " + wapmap);
            return System.callback(config.endCallback);
        }
        if(wapmap.length == 0) {
            Log.message("No links into wapmap");
            return System.callback(config.endCallback);
        }

        self.scrap(wapmap, config);
    });
}

WebDroneScraper.prototype.linksfile = function (config) {
    var self = this;
    if(!config)
        return;

    if(!config.mapfile)
        return System.callback(config.endCallback);

    self.mapfile = config.mapfile;
    self.request(
        {  
            hostname : config.hostname, 
            path : config.mapfile,
            port : config.port
        }, 
        function(err, info, data) {
            if(info.statusCode != 200)
                return System.callback(config.endCallback, ["status code error", info, null]);

            try {
                self.sitemap = JSON.parse(data);
            } catch (err) {
                var error = E(TestRouteApi.ERROR.TEST_JSONPARSE, err);
                return System.callback(config.endCallback, ["json parse error", info, null]);
            }

            if(!self.sitemap) {
                Log.error("Can not load sitemap from : " + self.mapfile);
                return System.callback(config.endCallback, ["map read error", info, null]);
            }

            var wapmap = [];
            for(var path in self.sitemap) {
                if(!self.sitemap.hasOwnProperty(path)) continue;

                var wap = self.sitemap[path];
                wap.path = path;
                wapmap.push(wap);
            }

            if(wapmap.length == 0)
                return System.callback(config.endCallback, ["empty map", info, null]);

            console.log("SCRAPMAP : ", wapmap);
            return self.scrap(wapmap, config);
        }
    );
}


// PRIVATE

function startStats () {
    return {
        load : []
    };
}

function generatStatsId (link, config) {
    if(!link)
        return "?";

    var hostname = link.hostname || config.hostname || "";
    var port = link.port || config.port || "";
    var path = link.path || "";
    var protocol = link.protocol || config.protocol || "";
    return (protocol ? protocol + "//" : "") + host + (port ? ":" + port : "") + path;
}

function stockStats (self, stats, wap, config, info, scrapinfo) {
    if(!stats) {
        Log.error("Missing stats object to stock info into it");
        return false;
    }

    config = config || {};
    var newstats = scrapinfo || {};
    if(!info || typeof(info) == "string") {
        newstats = {
            error : info || "unknwon error" 
        };
    } else {
        newstats = Object.assign(newstats, {
            hostname : wap.hostname || config.hostname,
            port : wap.port || config.port,
            path : wap.path,
            statusCode : info.statusCode,
            statusMessage : info.statusMessage,
            loadDuration : info.loadDuration,
            //cacheControl : info.headers && info.headers["cache-control"],
            contentType : info.headers && info.headers["content-type"],
            //connection : info.headers && info.headers["connection"],
            contentLength : parseInt(info.headers && info.headers["content-length"])
        });
    }

    stats.load.push(newstats);
    Wap.StockStats(newstats, function(err, savedStats) {
        console.log("stockStats : ", savedStats);
    });
    return newstats;
}

function sendUpdateStats (self, newstats) {
    if(!self) {
        Log.error("Missing main object");
        return;
    }
    if(self.updateStats) self.updateStats(newstats, self.stats);
}

function getScrapInfos (self, config, data) {
    if(!self || !config || !data)
        return;

    var $ = _cheerio.load(data);
    if(!$)
        return;

    var scrapinfo;
    if(config.scrapCallback) {
        scrapinfo = config.scrapCallback($) || {};
    } else {
        var titleinfo = $("h1");
        var canonical = $("link[rel='canonical']");
        scrapinfo = {
            title : titleinfo.text(),
            titleCount : titleinfo ? titleinfo.length : 0,
            canonical : canonical.attr("href")
        };
    }
    scrapinfo.droneinfo = getDroneInfos($);

    return scrapinfo;
}

function getDroneInfos ($) {
    if(!$) return;
    var droneinfo = $("#webdrone");
    return droneinfo.text();
}