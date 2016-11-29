var _mongoose = require("mongoose");
var _moment = require("moment");

var JsExt = require(ROOT_DIR + "/brain/jsext");
var Log = require(ROOT_DIR + "/brain/log");
var System = require(ROOT_DIR + "/brain/system");
var E = System.error;
var Doc = require(ROOT_DIR + "/models/doc");
var User = require(ROOT_DIR + "/models/user");

module.exports = Wap = Object.assign({}, Doc);

Wap.ERROR = System.registerErrors({
    WAP_PARAMS : "Missing required params",
    WAP_DB : "Error on DB",
    WAP_NOTFOUND : "Can not find the wap",
    WAP_DUPLICATE : "Duplicate entry",
    WAP_STATE : "State machine operation invalid",
    WAP_EDITING : "Wap already in edition",
    WAP_CONFIG : "Problems with wap configurations",
    WAP_PERMISSION : "Author doesn't have a permition to change the wap state",
    WAP_DRAFTNOTFOUND : "Can not find the draft, it must be create before edit it",
    WAP_NOUSER : "Can not identify a logged user"
});
Wap.MESSAGE = System.registerMessages({
    WAP_SUCCESS : "Operation success"
});
Wap.TYPE = "PAGE";
Wap.STATUS = {
    BLOCKED : "BLOCKED",
    PRIVATE : "PRIVATE",
    PUBLIC : "PUBLIC",
    ERROR : "ERROR",            //STATS
    WARNING : "WARNING",        //STATS
    OK : "OK"                   //STATS
};
Wap.STATE = {
    DRAFT : "DRAFT",            //DRAFT
    EDITING : "EDITING",        //DRAFT
    REVIEW : "REVIEW",          //DRAFT
    REPPROVED : "REPPROVED",    //DRAFT
    APPROVED : "APPROVED",      //DRAFT
    SCHEDULED : "SCHEDULED",    //DB
    FINISHED : "FINISHED"       //DB
};
Wap.DRAFTSTATES = [
    Wap.STATE.DRAFT,
    Wap.STATE.EDITING,
    Wap.STATE.REVIEW,
    Wap.STATE.REPPROVED,
    Wap.STATE.APPROVED
];

/**
 * Wap Schema
 */
Wap.Schema = new _mongoose.Schema({
    id : {type:String, unique:true, required:true},
    path : {type:String, unique:true, required:true},
    author : String,
    chiefeditor : String,
    priority : Number,
    since : {type:Date, default:Date.now},
    publicdate : {type:Date, default:Date.now},
    lastupdate : Date,

    type : String,
    resume : String,
    content : [],
    category : [String],
    crosslink : [String],
    alias : [String],

    status : {type:String, enum:JsExt.getObjectValues(Wap.STATUS)},
    state : {type:String, enum:JsExt.getObjectValues(Wap.STATE)},
    showcount : {type:Number, min:0},

    canonical : String,
    title : String,
    metatitle : String,
    metalocale : String,
    metadescription : String,
    metaentity : String,
    metaimage : String,
    metafollow : Boolean,
    metaindex : Boolean,

    statusCode : Number,
    statusMessage : String,
    loadDuration : Number,
    contentType : String,
    contentLength : Number,
    titleCount : Number,
    gtm : String,
    droneinfo : String,

    lastLoadDuration : Number,
    lastTitle : String,
    lastMetatitle : String,
    lastMetadescription : String

}, { strict: true });
Wap.PUBLIC_PROPERTIES = {
    path : 1,
    id : 1,
    author : 1,
    chiefeditor : 1,
    since : 1,
    publicdate : 1,
    lastupdate : 1,
    status : 1,
    state : 1,
    type : 1,
    resume : 1,
    content : 1,
    category : 1,
    crosslink : 1,
    showcount : 1,
    canonical : 1,
    title : 1,
    metatitle : 1,
    metalocale : 1,
    metadescription : 1,
    metaentity : 1,
    metaimage : 1,
    metafollow : 1,
    metaindex : 1
};
Wap.MAP_PROPERTIES = {
    path : 1,
    id : 1,
    status : 1,
    state : 1,
    type : 1,
    resume : 1,
    category : 1,
    canonical : 1,
    title : 1
};

Wap.DB = _mongoose.model("Wap", Wap.Schema);
Wap.DRAFT = _mongoose.model("WapDrafts", Wap.Schema);
Wap.STATS = _mongoose.model("WapStats", Wap.Schema);

/**
 * Create
 * @param wap object
 * @param callback function Callback params (error, savedWap)
 */
Wap.Create = function (wap, userid, callback) {
    var self = this;
    if(!wap || (!wap.path && !wap.id))
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, wap), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    if(self.IsDraft(wap.state))
        return self.DraftCreate(wap, userid, callback);

    var newwap = assertWap(self, new self.DB(), wap);

    newwap.save(callback);
}

Wap.IsDraft = function (state) {
    return !state || Wap.DRAFTSTATES.indexOf(state) >= 0;
}

/**
 * Get wap in all STATEs
 * @param {string} id Wap id
 * @param {function} callback - Callback signed as (error, savedWap)
 */
Wap.Get = function (id, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, id), null]);

    return self.DB.findOne({id:id}, self.PUBLIC_PROPERTIES, function(err, wap) {
        if(err)
            return System.callback(callback, [E(Wap.ERROR.WAP_DB, {error:err, id:id, wap:wap}), wap]);

        if(wap)
            return System.callback(callback, [null, wap]);

        return self.DRAFT.findOne({id:id}, self.PUBLIC_PROPERTIES, function(err, draft) {
            if(err)
                return System.callback(callback, [E(Wap.ERROR.WAP_DB, {error:err, id:id, draft:draft}), draft]);

            if(!draft)
                return System.callback(callback, [E(Wap.ERROR.WAP_NOTFOUND, id), draft]);

            return System.callback(callback, [null, draft]);
        });
    });
}

/**
 * Find return an array of waps that match with 'where'' filter properties
 * @param where Filter object that contains wap informations
 * @param callback function Callback params (error, waps)
 */
Wap.Find = function (where, callback) {
    var self = this;
    where = where || {};
    if(where.since) where.since = {$gt : where.since};
    if(where.publicdate) where.publicdate = {$gt : where.publicdate};
    if(where.lastupdate) where.lastupdate = {$gt : where.lastupdate};
    self.DB.find(where, self.PUBLIC_PROPERTIES, function(err, waps) {
        if(err)
            return System.callback(callback, [err, waps]);

        self.DRAFT.find(where, self.PUBLIC_PROPERTIES, function(err, drafts) {
            if(err)
                return System.callback(callback, [err, drafts]);

            waps = waps || [];
            drafts = drafts || [];
            var response = waps.concat(drafts);
            return System.callback(callback, [null, response]);
        });
    });
}

/**
 * GetMap return the list of registered waps
 * @param where Filter object
 * @param callback function Callback params (error, wapmap)
 */
Wap.GetMap = function (where, callback) {
    var self = this;
    where = where || {};
    return self.DB.find(
        where, 
        Wap.MAP_PROPERTIES,
        function(err, wapmap) {
            if(err || !wapmap)
                err = E(Doc.ERROR.DOC_NOTFOUND, {error:err, wapmap:wapmap});
            System.callback(callback, [err, wapmap]);
        }
    );
}

/**
 * StockStats stock stats information into STATS table
 * @param stats Object that contains stats and path
 * @param callback function Callback params (error, savedStats)
 */
Wap.StockStats = function (stats, callback) {
    var self = this;
    if(!stats || !stats.path)
        return System.callback(callback);

    Wap.STATS.findOne({path : stats.path}, {}, function(err, wapstats) {
        if(err || !wapstats) {
            //stock new stats
            newstats = assertWap(self, new Wap.STATS(), stats);
            newstats.save(callback); 
        } else {
            //keep last info
            stats.lastLoadDuration = wapstats.loadDuration,
            stats.lastTitle = wapstats.title;
            stats.lastMetatitle = wapstats.metatitle;
            stats.lastMetadescription = wapstats.metadescription;
            //update stats
            wapstats = Object.assign(wapstats, stats);
            wapstats.save(callback);
        }
    });
}

/**
 * GetStats return stats information
 * @param stats Filter object that contains stats informations
 * @param callback function Callback params (error, statsArr)
 */
Wap.GetStats = function (stats, callback) {
    Wap.STATS.find(stats, {}, callback);
}

/**
 * DraftCreate
 * @param wap object
 * @param callback function Callback params (error, savedDraft)
 */
Wap.DraftCreate = function (draft, userid, callback) {
    var self = this;
    if(!draft || (!draft.path && !draft.id))
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, draft), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    var newwap = assertWap(self, new self.DRAFT(), draft, {lastupdate: Date.now(), state : Wap.STATE.DRAFT});

    newwap.save(callback);
}

/**
 * DraftStart Start a draft wap (new or copy of a public version)
 * @param draft Wap object/config with id property
 * @param userid String Draft author
 * @param callback Callback(err, savedWapDraft)
 */
Wap.DraftStart = function (draft, userid, callback) {
    var self = this;
    if(!draft || (!draft.path && !draft.id))
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {draft:draft, userid:userid}), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    //search for a public version (SCHEDULED | PUBLIC) to copy instance
    self.Get(draft.id, function(err, wap) {
        if(err || !wap)
            return System.callback(callback, [err, wap]);

        var wapConfig = assertWap(self, {}, wap, {});
        draft = Object.assign(wapConfig, draft);
        draft.state = Wap.STATE.DRAFT;

        draft.author = userid;
        self.DraftCreate(draft, userid, callback);
    });
}

/**
 * DraftGet
 * @param id String
 * @param callback function Callback params (error, savedDraf)
 */
Wap.DraftGet = function (id, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, id), null]);

    return self.DRAFT.findOne({id:id}, self.PUBLIC_PROPERTIES, function(err, draft) {
        if(err || !draft) {
            err = E(Wap.ERROR.WAP_DRAFTNOTFOUND, {error:err, id:id, draft:draft});
            return System.callback(callback, [err, draft]);
        }
        return System.callback(callback, [err, draft]);
    });
}

/**
 * DraftUpdate
 * @param {Wap} draft - Draft wap version to update (need id)
 * @param {string} userid - Author user id
 * @param {function} callback - Callback params (error, savedDraf)
 */
Wap.DraftUpdate = function (draft, userid, callback) {
    var self = this;
    if(!draft || !draft.id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, id), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    self.DraftGet(draft.id, function(err, savedDraf) {
        if(err || !savedDraf)
            return System.callback(callback, [E(Wap.ERROR.WAP_DRAFTNOTFOUND, err), null]);

        if(savedDraf.state != Wap.STATE.EDITING)
            return System.callback(callback, [E(Wap.ERROR.WAP_STATE, draft), null]);
        if(savedDraf.author != userid)
            return System.callback(callback, [E(Wap.ERROR.WAP_PERMISSION), null]);

        savedDraf = Object.assign(savedDraf, draft);
        savedDraf.save(callback);
    });
}

/**
 * DraftStartEdition Start to edit a draft already started
 * @param id String draft id
 * @param userid String Draft author
 * @param callback Callback(err, savedWapDraft)
 */
Wap.DraftStartEdition = function (id, userid, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {id:id, userid:userid}), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    self.DraftGet(id, function(err, draft) {
        if(err && err.code != Wap.ERROR.WAP_DRAFTNOTFOUND)
            return System.callback(callback, [err, draft]);

        if(!draft)
            return self.DraftStart({id:id}, userid, callback);

        if(draft.state == Wap.STATE.EDITING && userid != draft.author)
            return System.callback(callback, [E(Wap.ERROR.WAP_EDITING), draft]);

        draft.state = Wap.STATE.EDITING;
        draft.author = userid;
        draft.save(callback);
    });
}

/**
 * DraftEndEdition End to edit a draft already in edition
 * @param id String draft id
 * @param userid String Draft author
 * @param callback Callback(err, savedWapDraft)
 */
Wap.DraftEndEdition = function (id, userid, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {id:id, userid:userid}), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    self.DraftGet(id, function(err, draft) {
        if(err || !draft)
            return System.callback(callback, [err, draft]);

        if(draft.state != Wap.STATE.EDITING)
            return System.callback(callback, [E(Wap.ERROR.WAP_STATE), null]);

        if(draft.author != userid)
            return System.callback(callback, [E(Wap.ERROR.WAP_PERMISSION), null]);

        draft.state = Wap.STATE.DRAFT;
        draft.save(callback);
    });
}

/**
 * DraftReview Send a draft to revision
 * @param id String draft id
 * @param userid String Draft author
 * @param callback Callback(err, savedWapDraft)
 */
Wap.DraftReview = function (id, userid, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {id:id, userid:userid}), null]);

    if(!userid)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    self.DraftGet(id, function(err, draft) {
        if(err || !draft)
            return System.callback(callback, [err, draft]);

        if(draft.state == Wap.STATE.EDITING && draft.author != userid)
            return System.callback(callback, [E(Wap.ERROR.WAP_PERMISSION), draft]);

        draft.state = Wap.STATE.REVIEW;
        draft.save(callback);
    });
}

/**
 * DraftReviewRepprove Reprove the revision draft
 * @param {string} id - Draft id
 * @param {user} user - User session object
 * @param {function} callback - Callback signed as (err, savedWapDraft)
 */
Wap.DraftReviewRepprove = function (id, user, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {id:id, userid:userid}), null]);

    if(!user || !user.id || !user.profile)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    if(user.profile != User.PROFILE.EDITOR && user.profile != User.PROFILE.ADMIN)
        return System.callback(callback, [E(Wap.ERROR.WAP_PERMISSION), null]);

    self.DraftGet(id, function(err, draft) {
        if(err || !draft)
            return System.callback(callback, [err, draft]);

        draft.state = Wap.STATE.REPPROVED;
        draft.chiefeditor = user.id;
        draft.save(callback);
    });
}

/**
 * DraftReviewApprove Aprove the revision draft
 * @param {string} id - Draft id
 * @param {user} user - User session object
 * @param {function} callback - Callback signed as (err, savedWapDraft)
 */
Wap.DraftReviewApprove = function (id, user, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {id:id, userid:userid}), null]);

    if(!user || !user.id || !user.profile)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    if(user.profile != User.PROFILE.EDITOR && user.profile != User.PROFILE.ADMIN)
        return System.callback(callback, [E(Wap.ERROR.WAP_PERMISSION), null]);

    self.DraftGet(id, function(err, draft) {
        if(err || !draft)
            return System.callback(callback, [err, draft]);

        draft.state = Wap.STATE.APPROVED;
        draft.chiefeditor = user.id;
        draft.save(callback);
    });
}

/**
 * DraftPublish Publish approved draft
 * @param id String draft id
 * @param user User object with profile information
 * @param userid String Draft chiefeditor
 * @param callback Callback(err, savedWapDraft)
 */
Wap.DraftPublish = function (id, user, publicdate, callback) {
    var self = this;
    if(!id)
        return System.callback(callback, [E(Wap.ERROR.WAP_PARAMS, {id:id}), null]);

    if(!user || !user.id || !user.profile)
        return System.callback(callback, [E(Wap.ERROR.WAP_NOUSER), null]);

    if(user.profile != User.PROFILE.EDITOR && user.profile != User.PROFILE.ADMIN)
        return System.callback(callback, [E(Wap.ERROR.WAP_PERMISSION), null]);

    self.DraftGet(id, function(err, draft) {
        if(err || !draft)
            return System.callback(callback, [err, draft]);

        draft.publicdate = publicdate;
        draft.state = dateInFuture(publicdate) ? Wap.STATE.SCHEDULED : Wap.STATE.FINISHED;

        self.Create(draft, user.id, function (err, wap) {
            if(err && err.code != 11000 && !wap)
                return System.callback(callback, [err, draft]);

            if(err && err.code == 11000 && wap) {
                wap = assertWap(self, wap, draft);
                return wap.save(function(err, savedWap) {
                    if(err || !savedWap)
                        return System.callback(callback, [err, savedWap]);

                    draft.remove();
                    return System.callback(callback, [null, wap]);
                });
            }

            draft.remove();
            return System.callback(callback, [null, wap]);
        });
    });
}

/**
 * PublishScheduled Search for SCHEDULED waps in the past to publish it 
 * @param callback function Callback params (error, waps)
 */
Wap.PublishScheduled = function (callback) {
    var self = this;
    var where = {
        state : Wap.STATE.SCHEDULED,
        publicdate : {$gte : _moment()}
    };
    self.DB.find(where, {}, function(err, waps) {
        if(err || !waps)
            return System.callback(callback, [err, waps]);
        
        if(waps.length <= 0)
            return System.callback(callback, [err, waps]);

        var pending = waps.length;
        waps.forEach(function(wap, index) {
            if(!wap) return;

            wap.status = Wap.STATUS.PUBLIC;
            wap.state = Wap.STATE.FINISHED;

            wap.save(function(err, savedWap) {
                if(--pending <= 0) System.callback(callback, [err, waps]);
            });
        })
    });

}


//PRIVATE
function assertWap (self, wap, config, defaultConfig) {
    if(!self)
        return;

    if(!wap || !config)
        return wap;

    var datenow = Date.now();
    defaultConfig = Object.assign(defaultConfig || {}, {
        lastupdate : datenow,
        since : datenow,
        publicdate : datenow,
        status : Wap.STATUS.PUBLIC,
        type : self.TYPE
    });
 
    wap.id = config.id || config.path;
    wap.path = config.path || config.id;
    wap.canonical = config.canonical;
    wap.author = config.author;
    wap.title = config.title;
    wap.metatitle = config.metatitle;
    wap.metalocale = config.metalocale;
    wap.metadescription = config.metadescription;
    wap.metaentity = config.metaentity;
    wap.metaimage = config.metaimage;
    wap.metafollow = config.metafollow;
    wap.metaindex = config.metaindex;
    wap.priority = config.priority;
    wap.lastupdate = config.lastupdate || defaultConfig.lastupdate;
    wap.since = config.since || defaultConfig.since;
    wap.publicdate = config.publicdate || defaultConfig.publicdate;
    wap.state = config.state || defaultConfig.state;
    wap.status = config.status || defaultConfig.status;
    wap.content = config.content;
    wap.type = config.type || defaultConfig.type;
    wap.resume = config.resume;
    wap.category = config.category;
    wap.crosslink = config.crosslink;
    wap.alias = config.alias;
    wap.showcount = 0;

    wap = assertStateMachine(wap);
    return wap;
}

function assertStateMachine (wap) {
    if(wap.state == Wap.STATE.PUBLIC) {
        var isPublicDateInFuture = dateInFuture(wap.publicdate);
        if(isPublicDateInFuture)
            wap.state = Wap.STATE.SCHEDULED;
    }
    return wap;
}

function dateInFuture (date) {
    if(!date) return false;

    var target = _moment(date, "DD/MM/YYYY");
    return _moment().diff(target) < 0;
}