var _querystring = require("querystring");

module.exports = JsExt = {};

// JS Type Extensions

if (!Function.prototype.extends) {
    Function.prototype.extends = function(ParentClass) {
        if(ParentClass.constructor == Function) {
            this.prototype = new ParentClass;
            this.prototype.constructor = this;
            this.prototype.parent = ParentClass.prototype;
        } else {
            this.prototype = ParentClass;
            this.prototype.constructor = this;
            this.prototype.parent = ParentClass;
        }
    }
}

if (!RegExp.escape) {
    RegExp.escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    };
}

if (!Array.prototype.unique) {
    Array.prototype.unique = function() {
        var a = this.concat();
        for(var i=0; i<a.length; ++i) {
            for(var j=i+1; j<a.length; ++j) {
                if(a[i] === a[j])
                    a.splice(j--, 1);
            }
        }
        return a;
    };
}

if (!Array.prototype.removeArray) {
    Array.prototype.removeArray = function(killer) {
        var a = this.concat();
        for(var i=0; i<killer.length; ++i) {
            var val = killer[i];
            var index = a.indexOf(val);
            if(index >= 0) {
                a.splice(index, 1);
            }
        }
        return a;
    };
}

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, "");
    }
}

if (!String.prototype.format) {
    String.prototype.format = function() {
        var str = this.toString();
        if (!arguments.length)
            return str;
        var args = typeof arguments[0],
            args = (("string" == args || "number" == args) ? arguments : arguments[0]);
        for (arg in args)
            str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
        return str;
    }
}

// Extension's functions

JsExt.getObjectValues = function (dataObject) {
    if(!dataObject)
        return;
    var dataArray = Object.keys(dataObject).map(function(k){return dataObject[k]});
    return dataArray;
}

JsExt.serializeDictionary = function (obj, connector) {
    if(!obj)
        return;

    connector = connector || ",";
    var builder = [];
    for (var i in obj) {
        if (!obj.hasOwnProperty(i) || typeof(i) === 'function') continue;

        builder.push(i + "=" + obj[i]);
    }
    return builder.join(connector);
}

JsExt.buildUrl = function (link, params, starter) {
    var serializedParams = typeof(params) == "string" ? params : _querystring.stringify(params);
    var url = link || "";
    if(serializedParams) {
        starter = starter || "?";
        if(url.indexOf(starter) < 0) {
            url += starter + serializedParams;
        } else {
            url = url.endsWith("&") ? url + serializedParams : url + "&" + serializedParams;
        }
    }

    return url;
}

JsExt.first = function(obj) {
    for (var i in obj) {
        if (!obj.hasOwnProperty(i) || typeof(i) === 'function') continue;

        return obj[i];
    }
}