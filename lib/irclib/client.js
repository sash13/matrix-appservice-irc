/*
 * Augments "User" objects with the ability to perform IRC actions.
 */
"use strict";
var q = require("q");
var log = require("../logging").get("irc-models");

function VirtualIrcUser(ircUser, userId) {
	this.server = ircUser.server;
	this.nick = ircUser.nick;
	this.userId = userId;
	this.joinedChannels = [];
};

VirtualIrcUser.prototype.connect = function(hooks) {
    var that = this;
    var promise = this.server.connectAs(this.nick, undefined, hooks);

    promise.done(function(client) {
        log.info("%s connected.", that.nick);
        that.client = client;
    });
    return promise;
};

VirtualIrcUser.prototype.joinChannel = function(channel) {
	if (this.joinedChannels.indexOf(channel) !== -1) {
		return q();
	}
    if (channel.indexOf("#") !== 0) {
        // PM room
        return q();
    }

	var defer = q.defer();
	var that = this;
	this.client.join(channel, function() {
		that.joinedChannels.push(channel);
		defer.resolve();
	});

	return defer.promise;
};

VirtualIrcUser.prototype.sendAction = function(room, action) {
    switch (action.action) {
        case "message":
            return this.sendMessage(room, "message", action.text);
        case "notice":
            return this.sendMessage(room, "notice", action.text);
        case "emote":
            return this.sendMessage(room, "action", action.text);
        case "topic":
            return this.setTopic(room, action.topic);
        default:
            log.error("Unknown action type: %s", action.action);
    }
    return q.reject("Unknown action type: %s", action.action);
};

VirtualIrcUser.prototype.sendMessage = function(room, msgType, text) {
    // join the room if we haven't already
    var defer = q.defer();
    var that = this;
    var msgType = msgType || "message";
    this.joinChannel(room.channel).done(function() {
    	if (msgType == "action") {
            that.client.action(room.channel, text);
        }
        else if (msgType == "notice") {
            that.client.ctcp(room.channel, "notice", text);
        }
        else if (msgType == "message") {
            that.client.say(room.channel, text);
        }
        defer.resolve();
    });
    return defer.promise;
};

VirtualIrcUser.prototype.setTopic = function(room, topic) {
    // join the room if we haven't already
    var defer = q.defer();
    var that = this;
    this.joinChannel(room.channel).done(function() {
        log.info("Setting topic to %s in channel %s", topic, room.channel);
        that.client.send("TOPIC", room.channel, topic);
        defer.resolve();
    });
    return defer.promise;
};
module.exports.VirtualIrcUser = VirtualIrcUser;
