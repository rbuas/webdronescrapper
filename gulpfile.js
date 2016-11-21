// Include gulp
var _gulp = require("gulp"); 
var _less = require("gulp-less");
var _minifyCSS = require("gulp-minify-css");
var _uglifyJS = require("gulp-uglify");
var _concat = require("gulp-concat");
var _path = require("path");
var _rename = require("gulp-rename");
var _gutil = require( "gulp-util" );
var _ftpvinyl = require( "vinyl-ftp" );
var _ftp = require("gulp-ftp");
var _jeditor = require("gulp-json-editor");
var _exec = require("child_process").exec;
var _argv = require("yargs").argv;

var builder = {
    CONFIG : require("./gulpconfig.json"),
    VERSION : require("./version.json"),
    actions : {
        "default" : {
            action : function() { builder.man(); }, 
            help : "builder manual"
        },
        "build" : {
            action : function() { builder.buildAll(); }, 
            help : "build all less and js"
        },
        "style-build" : {
            action : function() { builder.buildStyle(); }, 
            help : "build all less"
        },
        "style-watch" : {
            action : function() { builder.watchStyles(); }, 
            help : "watch all less"
        },
        "js-build" : {
            action : function() { builder.buildJS(); }, 
            help : "build all js"
        },
        "js-watch" : {
            action : function() { builder.watchJS(); }, 
            help : "watch all js"
        },
        "connectsb" : {
            action : function() { builder.connectSubProjects(); },
            help : "connect instance to the sub project surce"
        },
        "deploy-static" : {
            action : function() { builder.deploystatic() },
            help : "deploy static files into media server"
        },
        "deploy" : {
            action : function() { builder.deploy() },
            help : "deploy site to production environnement"
        },
    },
    process : {},

    initialize : function() {
        if(!builder || !builder.actions)
            return;

        console.log("Gulp initialize ...");
        for(var actionname in builder.actions) {
            if(!builder.actions.hasOwnProperty(actionname))
                continue;

            var aconfig = builder.actions[actionname];
            if(!aconfig || !aconfig.action)
                continue;

            _gulp.task(actionname, aconfig.action);
        }
    },

    man : function () {
        if(!builder || !builder.actions)
            return;

        console.log("---------------------------------------");
        console.log("Actions manual :");
        console.log("---------------------------------------");
        for(var actionname in builder.actions) {
            if(!builder.actions.hasOwnProperty(actionname))
                continue;

            var aconfig = builder.actions[actionname];
            if(!aconfig || !aconfig.action)
                continue;

            var tab = (actionname.length > 7) ? "\t\t: " : "\t\t\t: ";
            var help = aconfig.help || "";
            console.log(actionname + tab, help);
        }
        console.log("---------------------------------------");
    },

    validate : function (action) {
        action = action || "";

        if(!builder.CONFIG) {
            console.error("Missing config file :-(");
            return false;
        }
        if(!builder.actions) {
            console.error("Missing actions section :-(");
            return false;
        }
        if(!builder.actions[action]) {
            console.error("Missing action " + action + " :-(");
            return false;
        }

        return true;
    },

    buildAll : function () {
        if(!builder.validate("build")) return;

        builder.buildStyle();
        builder.buildJS();
    },

    buildStyle : function (file) {
        if(!builder.validate("style-build")) return;
        builder.startProcess("buildstyle");

        return _gulp.src(file || builder.CONFIG.styleinput)
            .pipe(_less().on("error", function(err) {
                console.log(err);
                this.emit("end");
            }))
            .pipe(_gulp.dest(builder.CONFIG.styleoutput))
            .pipe(_minifyCSS())
            .pipe(_rename({suffix: ".min"}))
            .pipe(_gulp.dest(builder.CONFIG.styleoutput))
            .on("error", function(err) {
                console.log(err);
            })
            .on("end", function() {
                builder.endProcess("buildstyle");
            });
    },

    watchStyles : function () {
        if(!builder.validate("style-watch")) return;

        return _gulp.watch(builder.CONFIG.stylefiles, function(event) {
            console.log("Builder::File " + event.path + " was " + event.type + "...");
            return builder.buildStyle();
        });
    },

    buildJS : function () {
        if(!builder.validate("js-build")) return;
        builder.startProcess("buildjs");

        return _gulp.src(builder.CONFIG.jsfiles)
            .pipe(_concat(builder.CONFIG.jspack))
            .pipe(_gulp.dest(builder.CONFIG.jsoutput))
            .pipe(_uglifyJS({mangle:false}))
            .pipe(_rename({suffix: ".min"}))
            .pipe(_gulp.dest(builder.CONFIG.jsoutput))
            .on("end", function() {
                builder.endProcess("buildjs");
            });
    },

    watchJS : function () {
        if(!builder.validate("js-watch")) return;

        return _gulp.watch(builder.CONFIG.jsfiles, function(event) {
            console.log("Builder::File " + event.path + " was " + event.type + "...");
            return builder.buildJS();
        });
    },

    startProcess : function(action) {
        if(!action || !builder || !builder.process)
            return;

        var start = new Date();
        builder.process[action] = start;
        var time = builder.formatDate(start);
        console.log("[" + time + "] Builder::Starting : '" + action + "' ...");
    },

    endProcess : function(action) {
        if(!action || !builder || !builder.process)
            return;

        var start = builder.process[action];
        builder.process[action] = null;
        delete builder.process[action];
        var end = new Date();
        var diff = Math.floor((end - start)/1000);
        var time = builder.formatDate(end);

        console.log("[" + time + "] Builder::Finished : '" + action + "' (" + diff + "s)");
    },

    formatDate : function(date) {
        if(!date)
            return "";

        var y = date.getFullYear();
        var M = (1 + date.getMonth());
        var d = date.getDate();
        var h = date.getHours();
        var m = date.getMinutes();
        var s = date.getSeconds();

        if(M < 10) M = "0" + M;
        if(d < 10) d = "0" + d;
        if(h < 10) h = "0" + h;
        if(m < 10) m = "0" + m;
        if(s < 10) s = "0" + s;

        return "" + y + M + d + ":" + h + ":" + m + ":" + s;
    },

    createDate : function(str) {
        if(!str)
            return;

        var year = str.substring(0, 4);
        var month = str.substring(4, 2);
        var day = str.substring(6, 2);
        var hours = str.substring(8, 2) || "00";
        var minutes = str.substring(10, 2) || "00";
        var seconds = str.substring(12, 2) || "00";
        return new Date(year, month, day, hours, minutes, seconds);
    },

    saveFile : function(filename, data) {
        _gulp.src("./" + filename)
          .pipe(_jeditor(data))
          .pipe(_gulp.dest("./" + filename));
    },

    connectSubProjects : function() {
        if(!builder.validate("connectsb")) return;
        builder.startProcess("connectsb");

        var subprojects = builder.CONFIG.subprojects;
        for(var link in subprojects) {
            if(!subprojects.hasOwnProperty(link))
                continue;

            var sb = subprojects[link];
            var command = "@mklink /D " + link + " " + sb;
            _exec(command, function (err, stdout, stderr) {
                console.log(stdout);
                console.log(stderr);
            });
            
        }
        builder.endProcess("connectsb");
    },

    deploystatic : function() {
        if(!builder.validate("deploy-static")) return;
        builder.startProcess("deploy-static");

        var config = builder.CONFIG.ftpconfig;
        config.log = _gutil.log;
        config.parallel = 20;

        var env = _argv && _argv.env || "production";
        var destination = (env && builder.CONFIG.remotepath[env]) ? builder.CONFIG.remotepath[env] : builder.CONFIG.remotepath["production"];

        var conn = _ftpvinyl.create(config);
        var params = { base: ".", buffer: false, debug: true };
        return _gulp.src( builder.CONFIG.deployfiles, params )
            //.pipe( conn.newer( builder.CONFIG.remotepath ) ) 
            .pipe( conn.dest( destination ) )
            .on("end", function() {
                builder.endProcess("deploy-static");
            });
    },

    deploy : function() {
        if(!builder.validate("deploy")) return;
        builder.startProcess("deploy");

        var version = _argv && _argv.v;
        if(!version) {
            console.log("ERROR: missing version (--v=versionnumber)");
            return -1;
        }

        var env = _argv && _argv.env || "integration";

        if(!builder.VERSION) {
            console.log("ERROR: missing version control");
            return -2;
        }

        var sinceDate = builder.createDate(builder.VERSION.date);
        var sinceText = builder.formatDate(sinceDate);

        var now = new Date();
        var nowText = builder.formatDate(now);

        //update version.json 
        builder.VERSION.version = version;
        builder.VERSION.date = nowText;
        builder.saveFile("version.json", builder.VERSION);

        //log action
        console.log("================================================================================");
        console.log("UPDATING version.json ...");
        console.log(builder.VERSION);

        console.log("================================================================================");
        console.log("PUBLISHING on " + env + " version " + version + " (" + sinceText + "/" + nowText + ")");
        console.log("================================================================================");

        //publish
        var deployComment = "Version " + version + " into " + env;
        _exec("git pull");
        _exec("git add --all");
        _exec("git commit '" + deployComment + "'");
        _exec("git tag -a " + version + " -m '" + deployComment + "'");
        _exec("git push " + env + " --tags");

        builder.endProcess("deploy");
    }
}
builder.initialize();