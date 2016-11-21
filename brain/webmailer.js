var _nodemailer = require("nodemailer");
var _fs = require("fs");

var Log = require(ROOT_DIR + "/brain/log");
var System = require(ROOT_DIR + "/brain/system");
var E = System.error;
var ViewEngine = require(ROOT_DIR + "/brain/viewengine");


module.exports = WebMailer;
function WebMailer (options) {
    var self = this;
    self.options = Object.assign(WebMailer.defaultoptions, options) || {};
    self.transporter = _nodemailer.createTransport(self.options.smtp);
}

WebMailer.defaultoptions = {
    smtp : {
        service : "MailGun",
        domaine : "sandbox7675be11bc2a485e8ed106a5f916dfe4.mailgun.org",
        api_key : "key-f26b43fc4e32cb9911f5bc63fe312b16",
        auth: {
            user: 'postmaster@sandbox7675be11bc2a485e8ed106a5f916dfe4.mailgun.org',
            pass: 'bcda9d2c8227c18bcdeec6e6a2b90a45'
        }
    },
    templateDir : __dirname + "/../views/"
}

WebMailer.FAKE = false;
WebMailer.VERBOSE = true;

WebMailer.ERROR = {};
WebMailer.ERRORMESSAGE = {};
System.registerErrors(WebMailer.ERRORMESSAGE);

WebMailer.prototype.send = function(options , callback) {
    var self = this;
    var mail = {};
    mail.to = options.to;
    mail.from = options.from;
    mail.subject = options.subject;

    if(options.mode == "HTML") {
        mail.html = ViewEngine.render(options.template, options.data);
    } else {
        mail.text = options.data;
    }

    if(WebMailer.VERBOSE) Log.message("WebMailer.send : ", mail, "yellow");

    if(WebMailer.FAKE) {
        if(WebMailer.VERBOSE) Log.message("WebMailer.FAKE send mail", mail.to, "cyan");
        return System.callback(callback, [null, mail]);
    }
    self.transporter.sendMail(mail, callback);
}