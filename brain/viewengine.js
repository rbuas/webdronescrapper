var _hbs = require("handlebars");
var _fs = require("fs");

var Log = require(ROOT_DIR + "/brain/log");
var System = require(ROOT_DIR + "/brain/system");
var E = System.error;


module.exports = ViewEngine = {};

ViewEngine.path = __dirname + "/../views/";
ViewEngine.ext = "html";
ViewEngine.templates = {};

ViewEngine.ERROR = System.registerErrors({});

ViewEngine.setPath = function (path) {
    ViewEngine.path = path;
}

ViewEngine.setExt = function (ext) {
    ViewEngine.ext = ext;
}

ViewEngine.resetcache = function () {
    ViewEngine.templates = {};
}

ViewEngine.render = function(template, data, force) {
    if(!template)
        return;

    var templateCompiled = ViewEngine.templates && ViewEngine.templates[template];
    if(force || !templateCompiled) {
        var templateContent = _fs.readFileSync(ViewEngine.path + template + "." + ViewEngine.ext, 'utf8');
        templateCompiled = ViewEngine.templates[template] = _hbs.compile(templateContent);
        if(!templateCompiled)
            return;
    }

    var html = templateCompiled(data);
    return html;
}