var _mongoose = require("mongoose");
var _bcrypt = require("bcrypt");
var _moment = require("moment");
var _querystring = require("querystring");
var _crypto = require("crypto");

var JsExt = require(ROOT_DIR + "/brain/jsext");
var Log = require(ROOT_DIR + "/brain/log");
var System = require(ROOT_DIR + "/brain/system");
var Config = require(ROOT_DIR + "/brain/config");
var E = System.error;

module.exports = Doc = {};

Doc.VERBOSE = true;

Doc.ERROR = System.registerErrors({
    DOC_PARAMS : "Missing required params",
    DOC_NOTFOUND : "Can not find the doc",
    DOC_DUPLICATE : "Duplicate entry"
});
Doc.MESSAGE = System.registerMessages({
    DOC_SUCCESS : "Operation success"
});


/**
 * Doc Schema
 */
Doc.Schema = new _mongoose.Schema({
    content : String,
    id : {type:String, unique:true},
    since : {type:Date, default:Date.now()},
    showcount : Number
}, { strict: true });


Doc.DB = _mongoose.model("Doc", Doc.Schema);


/**
 * Create
 * @param doc object
 * @param callback function Callback params (error, savedDoc)
 */
Doc.Create = function(doc, callback) {
    var self = this;
    if(!doc || !doc.content || !doc.id)
        return System.callback(callback, [E(Doc.ERROR.DOC_PARAMS, doc), null]);

    var newdoc = new self.DB();
    newdoc.since = doc.since || Date.now();
    newdoc.showcount = 0;
    newdoc.id = doc.id;
    newdoc.content = doc.content;

    newdoc.save(callback);
}


/**
 * Get
 * @param id String
 * @param callback function Callback params (error, doc)
 */
Doc.Get = function(id, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Doc.ERROR.DOC_PARAMS, id), null]);

    return self.DB.findOne(
        {id:id}, 
        {__v:0}, 
        function(err, doc) {
            if(err || !doc) {
                err = E(Doc.ERROR.DOC_NOTFOUND, {error:err, id:id, doc:doc});
                return System.callback(callback, [err, doc]);
            }

            doc.showcount++;
            doc.save(function(errSave, savedDoc) {
                System.callback(callback, [err, doc]);
            });
        }
    );
}


/**
 * GetByObjectId
 * @param id String
 * @param callback function Callback params (error, doc)
 */
Doc.GetByObjectId = function(id, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Doc.ERROR.DOC_PARAMS, id), null]);

    return self.DB.findOne(
        {_id:id}, 
        {__v:0}, 
        function(err, doc) {
            if(err || !doc)
                err = E(Doc.ERROR.DOC_NOTFOUND, {error:err, id:id, doc:doc});

            doc.showcount++;
            doc.save(function(errSave, savedDoc) {
                System.callback(callback, [err, doc]);
            });
        }
    );
}


/**
 * Update
 * @param doc object
 * @param callback function Callback params (error, savedDoc)
 */
Doc.Update = function (doc, callback) {
    var self = this;
    if(!doc || !doc.id)
        return System.callback(callback, [E(Doc.ERROR.DOC_PARAMS, doc), null])

    self.Get(doc.id, function(err, savedDoc) {
        if(err || !savedDoc)
            return System.callback(callback, [E(Doc.ERROR.DOC_NOTFOUND, err), null]);

        savedDoc = Object.assign(savedDoc, doc);
        savedDoc.save(callback);
    });
}


/**
 * Remove
 * @param where Doc properties in where syntaxe
 * @param callback function Callback params (error)
 */
Doc.Remove = function (where, callback) {
    var self = this;
    self.DB.remove(where, callback);
}


/**
 * Find
 * @param where Doc properties in where syntaxe
 * @param callback function Callback params (error, docs)
 */
Doc.Find = function(where, callback) {
    var self = this;
    if(where.text) where.text = new RegExp(RegExp.escape(where.text), 'i');
    if(where.author) where.author = new RegExp(RegExp.escape(where.author), 'i');
    if(where.since) where.since = {$gt : where.since};

    return self.DB.find(
        where, 
        {__v:0}, 
        function(err, docs) {
            if(err || !docs) {
                err = E(Doc.QUOTE.DOC_NOTFOUND, err);
                return System.callback(callback, [err, doc]);
            }

            docs.forEach(function(value, index) {
                value.showcount++;
                value.save();
            })
            if(callback) callback(err, docs);
        }
    );
}


/**
 * Random get a random doc
 * @param where Criteria object
 * @param count Number
 * @param callback function Callback params (error, docs)
 */
Doc.Random = function(where, count, callback) {
    var self = this;
    self.DB.count(where, function(err, catCount) {
        if(err)
            return System.callback(callback, [E(Doc.ERROR.DOC_COUNT, err), null]);

        if(count > catCount) count = catCount;
        var start = Math.floor(Math.random() * (catCount - count + 1));
        var query = self.DB.find(where)
        .skip(start)
        .limit(count)
        .exec(function(errFind, docs) {
            if(!docs)
                return;

            docs.forEach(function(value, index) {
                value.showcount++;
                value.save();
            });
            System.callback(callback, [errFind, docs]);
        });
    });
}