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
var WebMailer = require(ROOT_DIR + "/brain/webmailer");
var Dictionary = require(ROOT_DIR + "/brain/dictionary");
var I = Dictionary.get;

module.exports = User = {};

User.SALT_WORK_FACTOR = 10;
User.USING_ENCRIPT = true;
User.VERBOSE = true;

User.STATUS = {
    ON : "ON",
    OFF : "OF",
    CONFIRM : "CF",
    BLOCK : "BL",
    ANONYMOUS : "AN",
    REMOVED : "RM"
};
User.GENDER = {
    M : "M",
    MALE : "M",
    F : "F",
    FAMALE : "F"
};
User.PROFILE = {
    ADMIN : "AD",   //backoffice administrator
    EDITOR : "ED",  //middleoffice editor manager
    WRITER : "WR",  //middleoffice writer
    GUEST : "GS",   //middleoffice guest
    CLIENT : "CL"   //frontoffice client
};
User.ERROR = System.registerErrors({
    USER_WRONG_PASSWORD : "The password not match with registered password",
    USER_PARAMS : "Missing required params",
    USER_DATA : "Missing user data",
    USER_NOTFOUND : "Cant find the user",
    USER_UNKNOW : "Unknow user",
    USER_NOTLOGGED : "User not logged",
    USER_NOTAUTHORIZED : "User not authorized",
    USER_CONFIRMATION : "Waiting confirmation",
    USER_BLOCKED : "User blocked",
    USER_REMOVED : "User removed",
    USER_TOKEN : "User token doesn't match"
});
User.MESSAGE = System.registerMessages({
    USER_SUCCESS : "Operation success"
})

User.Mailer = new WebMailer();

/**
 * User Schema
 */
User.Schema = new _mongoose.Schema({
    email : {type:String, unique:true, required:true},
    password : {type:String, required:true},
    token : {type:String},
    label : String,
    name : String,
    birthday : Date,
    since : {type:Date, default:Date.now()},
    lastlogin : Date,
    status : {type:String, enum:JsExt.getObjectValues(User.STATUS), default: User.STATUS.ANONYMOUS},
    gender : {type:String, enum:JsExt.getObjectValues(User.GENDER)},
    profile : {type:String, enum:JsExt.getObjectValues(User.PROFILE), default: User.PROFILE.CLIENT},
    origin : String,
    lang : String,
    passport : [],
    favorite : [],
    history : []
}, { strict: true });

/**
 * ComparePassword
 * @param candidate string Password candidate
 * @param callback function Callback params (error, isMatch)
 */
User.Schema.methods.ComparePassword = function(candidate, callback) {
    if(User.USING_ENCRIPT) {
        _bcrypt.compare(candidate, this.password, function(err, isMatch) {
            var error = !isMatch ? E(User.ERROR.USER_WRONG_PASSWORD, err) : null;
            if(callback) return callback(error, isMatch);
        });
    } else {
        var isMatch = this.password == candidate;
        var error = !isMatch ? E(User.ERROR.USER_WRONG_PASSWORD) : null;
        if(callback) return callback(error, isMatch);
    }
}

User.Schema.pre("save", function(next) {
    var user = this;

    // status settings
    if(user.isNew && user.isAnonymous) {
        user.status = User.STATUS.ANONYMOUS;
    }
    else if(user.isModified("email")) {
        user.status = user.forcestatus || User.STATUS.CONFIRM;
    }
    else {
        user.status = user.forcestatus || user.status || User.STATUS.CONFIRM;
    }

    user.label = user.label || user.email && user.email.substr(0, user.email.indexOf("@"));

    if(User.USING_ENCRIPT) {
        // only hash the password if it has been modified (or is new)
        if (!user.isModified("password")) return next();

        // generate a salt
        _bcrypt.genSalt(User.SALT_WORK_FACTOR || 10, function(err, salt) {
            if (err) return next(err);

            // hash the password using the new salt
            _bcrypt.hash(user.password, salt, function(err, hash) {
                if (err) return next(err);

                // override the cleartext password with the hashed one
                user.password = hash;
                next();
            });
        });
    } else {
        next();
    }

    if(user.status == User.STATUS.CONFIRM) {
        User.Mailer.send({
            to : user.email,
            subject : I("USER_MAILCONFIRM_SUBJECT", user.lang),
            from : I("USER_MAILFROM", user.lang),
            mode : "HTML",
            data : {
                useremail : user.email,
                username : user.name,
                confirmlink : siteLink("/s/user-confirm/" + user._id),
                title : I("USER_MAILCONFIRM_TITLE", user.lang),
                pretext : I("USER_MAILCONFIRM_PRETEXT", user.lang),
                postext : I("USER_MAILCONFIRM_POSTEXT", user.lang)
            },
            template : "user_mail_confirm"
        }, function(err, info) {
            if(User.VERBOSE && err)
                Log.trace("USER.SCHEMA.PRESAVE : error on send mail to " + user.email, err);
        });
    }
});

User.DB = _mongoose.model("User", User.Schema);

/**
 * Create
 * @param user object
 * @param callback function Callback params (error, savedUser)
 */
User.Create = function(user, callback) {
    var self = this;
    if(!user || !user.email || !user.password) {
        if(callback) callback(E(User.ERROR.USER_PARAMS, user), null);
        return;
    }

    var newuser = new self.DB();
    newuser.email = user.email;
    newuser.label = user.label;
    newuser.password = user.password;
    newuser.token = _crypto.randomBytes(16).toString('hex');
    newuser.name = user.name;
    newuser.birthday = user.birthday && _moment.utc(user.birthday, "MM-DD-YYYY");
    newuser.since = user.since || Date.now();
    newuser.lastlogin = user.lastlogin;
    newuser.gender = user.gender;
    newuser.origin = user.origin;
    newuser.profile = user.profile;
    newuser.lang = user.lang;
    newuser.status = user.status;
    newuser.forcestatus = user.forcestatus;
    newuser.passport = [];
    newuser.favorite = [];
    newuser.history = [];

    newuser.save(callback);
}


/**
 * Get
 * @param email User email
 * @param callback function Callback params (error, user)
 */
User.Get = function(email, callback) {
    var self = this;
    if(!email) {
        if(callback) callback(E(User.ERROR.USER_PARAMS));
        return;
    }

    return self.DB.findOne(
        {email:email}, 
        {password:0, history:0, __v:0}, 
        function(err, user) {
            if(err || !user) {
                err = E(User.ERROR.USER_NOTFOUND, {error:err, email:email, user:user});
            }
            if(callback) callback(err, user);
        }
    );
}


/**
 * CreateAnonymous
 * @param user object
 * @param callback function Callback params (error, savedUser)
 */
User.CreateAnonymous = function(callback) {
    var self = this;
    var newuser = new self.DB();
    newuser.email = newuser.id + "@anonymous.com";
    newuser.password = "a";
    newuser.isAnonymous = true;

    newuser.save(callback);
}


/**
 * Update
 * @param user object User with newmail possibility
 * @param callback function Callback params (error, savedUser)
 */
User.Update = function (user, callback) {
    var self = this;
    if(!user || !user.email)
        return System.callback(callback, [E(User.ERROR.USER_PARAMS, user), null]);

    var oldmail = user.email;
    self.Get(oldmail, function(err, savedUser) {
        if(err || !savedUser) {
            if(callback) callback(E(User.ERROR.USER_NOTFOUND, err));
            return;
        }
        var newemail = user.newemail || user.email;
        user.email = newemail;
        savedUser = Object.assign(savedUser, user);
        savedUser.save(callback);
    });
}


/**
 * Remove
 * @param where User properties in where syntaxe
 * @param callback function Callback params (error)
 */
User.Remove = function (where, callback) {
    var self = this;
    self.DB.remove(where, callback);
}


/**
 * SoftRemove Remove user from the system but keep in memory.
 * 
 * @param callback function Callback params (error, savedUser)
 */
User.SoftRemove = function(email, password, callback) {
    var self = this;
    if(!email || !password) {
        if(callback) callback(E(User.ERROR.USER_PARAMS), null);
        return;
    }

    self.DB.findOne({email:email}, function(err, user) {
        if(!user) {
            if(callback) callback(E(User.ERROR.USER_UNKNOW), null);
            return;
        }

        user.ComparePassword(password, function(err, match) {
            if(err) {
                if(callback) callback(err, user);
                return;
            }

            user.status = User.STATUS.REMOVED;
            user.save(callback);
        });
    });
}


/**
 * Restore Restore a soft removed user.
 * 
 * @param callback function Callback params (error, savedUser)
 */
User.Restore = function(email, callback) {
    var self = this;
    if(!email) {
        if(callback) callback(E(User.ERROR.USER_PARAMS), null);
        return;
    }

    self.DB.findOne({email:email}, function(err, user) {
        if(!user) {
            if(callback) callback(E(User.ERROR.USER_UNKNOW), null);
            return;
        }

        user.status = User.STATUS.CONFIRM;
        user.save(callback);
    });
}


/**
 * Find
 * @param where User properties in where syntaxe
 * @param callback function Callback params (error, users)
 */
User.Find = function(where, callback) {
    var self = this;
    if(where.name) where.name = new RegExp(RegExp.escape(where.name), 'i');
    if(where.email) where.email = new RegExp(RegExp.escape(where.email), 'i');
    if(where.label) where.label = new RegExp(RegExp.escape(where.label), 'i');
    if(where.since) where.since = {$gt : where.since};
    if(where.lastlogin) where.lastlogin = {$gt : where.lastlogin};

    return self.DB.find(
        where, 
        {password:0, token:0, history:0, __v:0}, 
        function(err, users) {
            if(err || !users) {
                err = E(User.ERROR.USER_NOTFOUND, err);
            }
            if(callback) callback(err, users);
        }
    );
}


/**
 * Purge the users with 'status'' from 'days'
 * 
 * @param status enum User.STATUS option
 * @param days number To purge all ANONYMOUS users registered more than 'days'
 * @param callback function Callback params (error)
 */
User.Purge = function(days, status, callback) {
    var self = this;
    if(days == null || !status) {
        if(callback) callback(E(User.ERROR.USER_PARAMS));
        return;
    }
    var where = {status:status};
    if(days) where.since = {$lt : _moment().subtract(days, "days")};

    self.DB.remove(where, callback);
}


/**
 * Confirm the users with 'status'' from 'days'
 * 
 * @param token string token (id) to confirm user
 * @param callback function Callback params (error, savedUser)
 */
User.Confirm = function(token, callback) {
    var self = this;
    if(!token) {
        if(callback) callback(E(User.ERROR.USER_PARAMS), null);
        return;
    }

    self.Find({_id:token}, function(err, users) {
        var user = users && users.length ? users[0] : null;
        if(!user) {
            if(callback) callback(E(User.ERROR.USER_TOKEN), null);
            return;
        }

        user.status = User.STATUS.OFF;
        user.save(callback);
    });
}


/**
 * GetResetToken
 * 
 * @param email string User email id
 * @param callback function Callback params (error, token)
 */
User.GetResetToken = function(email, callback) {
    var self = this;
    if(!email) {
        if(callback) callback(E(User.ERROR.USER_PARAMS), null);
        return;
    }

    return self.DB.findOne(
        {email:email}, 
        function(err, user) {
            var token = null;
            if(err || !user) {
                err = E(User.ERROR.USER_NOTFOUND, err);
            } else {
                token = user.token;
            }
            if(callback) callback(err, token);
        }
    );
}


/**
 * ResetPassword
 * 
 * @param email string User email id
 * @param token string token (password) to reset user password
 * @param newuser string New user password
 * @param callback function Callback params (error, user)
 */
User.ResetPassword = function(userid, token, newpassword, callback) {
    var self = this;
    if(!userid || !token || !newpassword)
        return System.callback(callback, [E(User.ERROR.USER_PARAMS)]);

    self.DB.findOne({_id:userid}, function(err, user) {
        if(!user)
            return System.callback(callback, [E(User.ERROR.USER_PARAMS)]);

        if(token != user.token)
            return System.callback(callback, [E(User.ERROR.USER_TOKEN)]);

        user.password = newpassword;
        user.save(callback);
    });
}

/**
 * AskResetPassword
 * 
 * @param email string User email id
 * @param token string token (password) to reset user password
 * @param newuser string New user password
 * @param callback function Callback params (error)
 */
User.AskResetPassword = function(email, callback) {
    var self = this;
    if(!email)
        return System.callback(callback, [E(User.ERROR.USER_PARAMS)]);

    self.DB.findOne(
        {email:email},
        function(err, user) {
            if(err || !user)
                return System.callback(callback, [err]);

            var userid = user._id;
            var token = user.token;
            if(!userid || !token)
                return System.callback(callback, [E(User.ERROR.USER_DATA, {userid:userid,token:token})]);

            self.Mailer.send(
                {
                    to : email,
                    subject : I("USER_RESETPASS_SUBJECT", user.lang),
                    from : I("USER_MAILFROM", user.lang),
                    mode : "HTML",
                    data : {
                        useremail : user.email,
                        username : user.name,
                        confirmlink : siteLink("/resetpassword/" + userid + "/" + token),
                        title : I("USER_RESETPASS_TITLE", user.lang),
                        pretext : I("USER_RESETPASS_PRETEXT", user.lang),
                        postext : I("USER_RESETPASS_POSTEXT", user.lang)
                    },
                    template : "user_password_reset"
                }, 
                function(err, info) {
                    if(User.VERBOSE && err)
                        Log.trace("USER.ASKRESETPASSWORD : error on send mail to " + user.email, err);

                    System.callback(callback);
                }
            );
        }
    );
}


/**
 * Login
 * 
 * @param email string User email
 * @param password string User password
 * @param callback function Callback params (error, user)
 */
User.Login = function (email, password, callback) {
    var self = this;
    if(!email || !password) {
        if(callback) callback(E(User.ERROR.USER_PARAMS));
        return;
    }

    return self.DB.findOne({email:email}, function(err, user) {
        if(err || !user) {
            if(callback) callback(E(User.ERROR.USER_NOTFOUND, err), user);
            return;
        }
        user.ComparePassword(password, function(err, match) {
            if(err) {
                if(callback) callback(err, user);
                return;
            }

            switch (user.status) {
                case User.STATUS.CONFIRM:
                    err = E(User.ERROR.USER_CONFIRMATION);
                    break;
                case User.STATUS.BLOCK:
                    err = E(User.ERROR.USER_BLOCKED);
                    break;
                case User.STATUS.REMOVED:
                    err = E(User.ERROR.USER_REMOVED);
                    break;
                case User.STATUS.OFF:
                    user.status = User.STATUS.ON;
                    user.lastlogin = _moment();
                    user.save();
                    break;
                default:
                    break;
            }

            if(callback) callback(err, user);
        });
    });
}


/**
 * Logout
 * 
 * @param email string User email
 * @param password string User password
 * @param callback function Callback params (error, user)
 */
User.Logout = function(email, callback) {
    var self = this;
    if(!email) {
        if(callback) callback(E(User.ERROR.USER_PARAMS));
        return;
    }

    return self.DB.findOne({email:email}, function(err, user) {
        if(err || !user) {
            if(callback) callback(E(User.ERROR.USER_NOTFOUND, err), user);
            return;
        }
        user.status = User.STATUS.OFF;
        user.save(callback);
    });
}


User.AddPassport = function(email, passport, callback) {
    var self = this;
    if(!email || !passport)
        return System.callback(callback, [E(User.ERROR.USER_PARAMS)]);

    return self.Get(email, function(err, user) {
        if(err || !user)
            return System.callback(callback, err);

        if(typeof(passport) == "string") passport = [passport];

        user.passport = user.passport || [];
        user.passport = user.passport.concat(passport);
        user.passport = user.passport.unique();
        user.save(callback);
    });
}

User.RemovePassport = function(email, passport, callback) {
    var self = this;
    if(!email || !passport)
        return System.callback(callback, [E(User.ERROR.USER_PARAMS)]);

    return self.Get(email, function(err, user) {
        if(err || !user)
            return System.callback(callback, err);

        if(typeof(passport) == "string") passport = [passport];

        user.passport = user.passport || [];
        user.passport = user.passport.removeArray(passport);
        user.save(callback);
    });
}


// AUXILIAR

User.saveUserSession = function(req, user) {
    if(!req || !user)
        return;

    req.session.user = {
        id : user.id || user._id,
        label : user.label,
        name : user.name,
        status : user.status,
        email : user.email,
        lang : user.lang,
        profile : user.profile,
        logged : user.status == User.STATUS.ON
    };
}

User.VerifyLogged = function(req, prop) {
    var logged = req && req.session && req.session.user && req.session.user.logged;
    if(!logged)
        return null;

    return prop ? req.session.user[prop] : req.session.user;
}

User.VerifyProfile = function(req, profile) {
    var user = User.VerifyLogged(req);
    if(!user)
        return false;

    var userProfile = user.profile;
    if(typeof(profile) == "string") {
        return profile == userProfile;
    }

    return profile.indexOf(userProfile) >= 0;
}


// PRIVATE

function siteLink (path) {
    var host = Config.get("SITE_URL") || "";
    if(!host)
        return path;

    return "//" + host + path;
}