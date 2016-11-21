var _mongoose = require('mongoose');

var Log = require(ROOT_DIR + "/brain/log");

module.exports = Memory;
function Memory (options) {
    var self = this;
    self.options = Object.assign(self.defaultoptions, options) || {};

    self.connect(self.options.onconnect);
}

Memory.prototype.defaultoptions = {
    db : "mongodb://localhost/test"
    //onconnect : function to call on connection response
};

Memory.prototype.connect = function(callback) {
    var self = this;
    if(!self.options.db)
        return;

    _mongoose.connect(self.options.db);
    _mongoose.Promise = global.Promise;
    self.callbackCalled = false;

    _mongoose.connection.on("connected", function() {
        Log.message("Mongoose connected to " + self.options.db);
        if(callback && !self.callbackCalled) {
            callback();
            self.callbackCalled = true;
        }
    });

    _mongoose.connection.on("error", function(err) {
        Log.error("Mongoose connection error : " + err);
        if(callback && !self.callbackCalled) {
            callback();
            self.callbackCalled = true;
        }
    });

    _mongoose.connection.on("disconnect", function () {
        Log.message("Mongoose disconnected");
    });
}

Memory.prototype.disconnect = function(callback) {
    _mongoose.disconnect(callback);
}