var _mongoose = require("mongoose");
var _moment = require("moment");
var _querystring = require("querystring");

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