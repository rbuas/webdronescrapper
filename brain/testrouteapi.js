var _http = require("http");
var _cheerio = require("cheerio");
var _querystring = require("querystring");
var _expect = require("chai").expect;
var _assert = require("chai").assert;
var _should = require("chai").should();

var JsExt = require(ROOT_DIR + "/brain/jsext");
var System = require(ROOT_DIR + "/brain/system");
var E = System.error;

module.exports = TestRouteApi;


function TestRouteApi (options) {
    var self = this;
    self.options = Object.assign(TestRouteApi.defaultoptions, options) || {};
    self.keepsession = false || self.options.keepsession;
    self.sessionCookie = null;
}


TestRouteApi.defaultoptions = { urlbase : "localhost", port : 8080};


TestRouteApi.ERROR = System.registerErrors({
    TEST_JSONPARSE : "Can not parse json data",
    TEST_SERVER : "Internal server error",
    TEST_STEP_VERIFICATION : "Error in step verification"
});


TestRouteApi.prototype.setKeepSession = function (active)
{
    var self = this;
    self.keepsession = active;
}


TestRouteApi.prototype.resetSession = function() 
{
    var self = this;
    self.sessionCookie = null;
}


/**
 * request
 * 
 * @param options Object : {
 *      method string Request method, default is GET
 *      path string Link to test
 *      data object Parameters dictionary ( key = value )
 * }
 * callback function Callback params (error, duration, responsedata)
 */
TestRouteApi.prototype.request = function (options, callback) {
    var self = this;
    if(!options)
        return;

    var method = options.method || "GET";
    var path = options.path;
    var dataString = JSON.stringify(options.data);
    var info = {
        startTime : new Date(),
        requestData : options.data,
        request : {
            method : method,
            port : options.port || self.options.port,
            path : path || "/",
            hostname : options.hostname || self.options.urlbase,
            headers : {}
        }
    };
    if(method == "GET") {
        var querystring = _querystring.stringify(options.data);
        info.request.path = JsExt.buildUrl(path, querystring);
    } else if(method == "POST") {
        info.request.headers['Content-Type'] = 'application/json';
        info.request.headers['Connection'] = 'keep-alive';
        info.request.headers['Content-Length'] = dataString && dataString.length || 0;
        info.request.json = true;
    }

    if(self.keepsession) {
        if(self.sessionCookie) info.request.headers['Cookie'] = self.sessionCookie;
        info.request.headers["Connection"] = "keep-alive";
        info.request.agent = new _http.Agent({
            maxSockets: 1,
            timeout: 60000,
            keepAliveTimeout: 30000
        });
    }

    var request = _http.request(info.request, function(res) {
        var data = "";
        res.setEncoding('utf8');
        info.headers = res.headers;
        if(self.keepsession) {
            var cookie = res.headers["set-cookie"];
            self.sessionCookie = cookie && cookie.length > 0 && cookie[0] || self.sessionCookie;
        }
        res.on("data", function(d) {
            data += d;
        });
        res.on("end", function() {
            info.endTime = new Date();
            info.duration = info.endTime - info.startTime;
            info.statusCode = this.statusCode;
            info.statusMessage = this.statusMessage;
            if(info.statusCode != 200) {
                var error = E(TestRouteApi.ERROR.TEST_SERVER, data);
                if(callback) callback(error, info, null);
                return;
            }
            try {
                var parsed = JSON.parse(data);
            } catch (err) {
                var error = E(TestRouteApi.ERROR.TEST_JSONPARSE, err);
                if(callback) callback(error, info, null);
                return;
            }
            if(callback) callback(null, info, parsed);
        });
    }).on("error", function(error) {
        info.endTime = new Date();
        info.duration = info.endTime - info.startTime;

        if(callback) callback(error, info, null);
    });

    if(dataString && method == "POST") {
        request.write(dataString);
    }

    request.end();
}


/**
 * parcours
 * 
 * @param steps [Step] Step = {
 *      action function Step action
 *      params [arg] Step params to action without callback
 *      verify callback Returns true/false to validate from action : callback(err, info, data)
 * }
 * callback function Callback params ()
 */
TestRouteApi.prototype.parcours = function (steps, callback, stepindex) {
    var self = this;
    stepindex = stepindex || 0;

    if(stepindex >= steps.length)
        return System.callback(callback, [null]);

    var step = steps[stepindex];
    if(!step || !step.action)
        return Log.error("Parcous step error");

    var params = step.params || [];
    params.push(function(err, info, data) {
        if(step.verify) _expect(step.verify(err, info, data)).to.be.equal(true, "parcours step : " + stepindex);

        self.parcours(steps, callback, ++stepindex);
    });
    step.action.apply(self, params);
}