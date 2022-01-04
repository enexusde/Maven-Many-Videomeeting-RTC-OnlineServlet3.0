function Sender(webcam, stunUrl) {
	var self = this;
	self.webcam = webcam;
	self.peerConn = null;
	self.stunUrl = stunUrl;
	self.createOffer = function(callback) {
		self.peerConn = new RTCPeerConnection({ iceServers: [{ urls: self.stunUrl }] });
		self.peerConn.addStream(self.webcam);
		var callbackCalled = false;
		console.log(1);
		self.peerConn.createOffer().then(des => {
			self.peerConn.setLocalDescription(des).then(function() {
				self.peerConn.onicegatheringstatechange = function(y) {
					if (y != "complete") {
						if (callbackCalled == false) {
							callbackCalled = true;
							callback(self.peerConn.localDescription.sdp);
						}
					}
				}
			});
		});
	}
	self.notifyAnswer = function(answerSDP) {
		self.peerConn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSDP }));
	}
}

function OLESender(sender) {
	var self = this;
	self.sender = sender;
	self.createOffer = function(callback) {
		return self.sender.createOffer(function(sdp) {
			callback(btoa(JSON.stringify(sdp)));
		});
	}
	self.notifyAnswer = function(answerSDP) {
		return self.sender.notifyAnswer(JSON.parse(atob(answerSDP)));
	}
}

function Recipient(webcam, stunUrl) {
	var self = this;
	self.webcam = webcam;
	self.peerConn = null;
	self.streamEvents = [];
	self.stunUrl = stunUrl;
	self.streamEventsChangedHandler = [];


	self.notifyOffer = function(offerSDP, callback) {
		self.peerConn = new RTCPeerConnection({ iceServers: [{ urls: self.stunUrl }] });
		self.peerConn.onaddstream = function(event) {
			self.streamEvents.push(event);
			for (var i = 0; i < self.streamEventsChangedHandler.length; i++) {
				self.streamEventsChangedHandler[i](self.streamEvents);
			}
		}
		self.peerConn.addStream(self.webcam);
		self.peerConn.setRemoteDescription({ type: 'offer', sdp: offerSDP }).then(function() {
			callback();
		});
	}
	self.createAnswerSDP = function(callback) {
		self.peerConn.createAnswer().then(function(answer) {
			self.peerConn.setLocalDescription(answer);
			callback(answer.sdp);
		});
	}
	self.addOnStreamEventsChangedHandler = function(handler) {
		self.streamEventsChangedHandler.push(handler);
	}
}

function OLERecipient(recipient) {
	var self = this;
	self.recipient = recipient;
	self.notifyOffer = function(offerSDP, callback) {
		return self.recipient.notifyOffer(JSON.parse(atob(offerSDP)), callback);
	};
	self.createAnswerSDP = function(callback) {
		return self.recipient.createAnswerSDP(function(sdp) {
			callback(btoa(JSON.stringify(sdp)));
		});
	}
	self.addOnStreamEventsChangedHandler = function(handler) {
		self.recipient.addOnStreamEventsChangedHandler(handler);
	}
}

function Room(stunUrl) {
	var self = this;
	self.sessionId = null;
	self.webcam = null;
	self.lastAliveSent = null;
	self.pcs = {};
	self.stunUrl = stunUrl;
	self.triggerHeartBeat = function() {
		var x = new XMLHttpRequest();
		x.open('POST', 'meet');
		x.setRequestHeader('X-session', self.sessionId);
		x.onreadystatechange = function() {
			if (x.readyState == XMLHttpRequest.DONE) {
				self.lastAliveSent = new Date();
				var commandLines = x.responseText.split("\n");
				for (var i = 0; i < commandLines.length; i++) {
					self.executeCommandLine(commandLines[i]);
				}
			}
		}
		x.send('HEARTBEAT');
	}
	self.executeCommandLine = function(commandLine) {
		if (commandLine.indexOf("FORGET_UNKNOWN_SESSION:") == 0) {
			var outgoingSessionId = commandLine.substring(23);
			delete self.pcs[outgoingSessionId];
			for (var i = 0; i < self.onSessionOutgoingHandlers.length; i++) {
				self.onSessionOutgoingHandlers[i](outgoingSessionId);
			}
		} else if (commandLine.indexOf("ADD:") == 0) {
			var incommingSessionId = commandLine.substring(4);
			var h = self.onSessionIncommingHandlers;
			self.pcs[incommingSessionId] = new OLERecipient(new Recipient(self.webcam, self.stunUrl));
			for (var i = 0; i < h.length; i++) {
				h[i](incommingSessionId, self.pcs[incommingSessionId]);
			}
		} else if (commandLine.indexOf("CREATE_OFFER:") == 0) {
			var forSessionId = commandLine.substring(13);
			var oleSender = new OLESender(new Sender(self.webcam, self.stunUrl));
			self.pcs[forSessionId] = oleSender;
			oleSender.createOffer(function(createdOLESDP) {
				var x = new XMLHttpRequest();
				x.open('POST', 'meet');
				x.setRequestHeader('X-session', self.sessionId);
				x.onreadystatechange = function() {
					if (x.readyState == XMLHttpRequest.DONE) {
						self.lastAliveSent = new Date();
						var commandLines = x.responseText.split("\n");
						for (var i = 0; i < commandLines.length; i++) {
							self.executeCommandLine(commandLines[i]);
						}
					}
				}
				x.send('OFFER_SDP:' + forSessionId + ":" + createdOLESDP);
			});
		} else if (commandLine.indexOf("INCOMMING_OFFER:") == 0) {
			var payload = commandLine.substring(16);
			var fromSessionId = payload.substring(0, payload.indexOf(':'));
			var offer = payload.substring(payload.indexOf(':') + 1);
			var oleRecipient = self.pcs[fromSessionId];
			oleRecipient.notifyOffer(offer, function() {
				oleRecipient.createAnswerSDP(function(sdp) {
					var x = new XMLHttpRequest();
					x.open('POST', 'meet');
					x.setRequestHeader('X-session', self.sessionId);
					x.onreadystatechange = function() {
						if (x.readyState == XMLHttpRequest.DONE) {
							console.log(x.responseText);
						}
					}
					x.send('ANSWER:' + fromSessionId + ':' + sdp);

				});
			});
		} else if (commandLine.indexOf("REM:") == 0) {
			var outgoingSessionId = commandLine.substring(4);
			delete self.pcs[outgoingSessionId];
			for (var i = 0; i < self.onSessionOutgoingHandlers.length; i++) {
				self.onSessionOutgoingHandlers[i](outgoingSessionId);
			}
		} else if (commandLine.indexOf("INCOMMING_ANSWER:") == 0) {
			var answeringSessionIdAndSDF = commandLine.substring(17);
			var colonPos = answeringSessionIdAndSDF.indexOf(':');
			var answeringSessionId = answeringSessionIdAndSDF.substring(0, colonPos);
			var answeringSDP = answeringSessionIdAndSDF.substring(colonPos + 1);
			var oleSender = self.pcs[answeringSessionId];
			oleSender.notifyAnswer(answeringSDP);
		} else if (commandLine == '') {
		} else {
			console.log("Message unknwon: ", commandLine);
		}
	};
	self.startAliveHeartbeat = function() {
		window.setInterval(self.triggerHeartBeat, 1000);
	};
	self.sessionCreated = function() {
		navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function(cam) {
			self.webcam = cam;
		});
	}
	self.onSessionIncommingHandlers = [];
	self.onSessionOutgoingHandlers = [];
	self.addOnSessionIncomming = function(h) {
		self.onSessionIncommingHandlers.push(h);
	}
	self.addOnSessionOutgoing = function(h) {
		self.onSessionOutgoingHandlers.push(h);
	}

	var x = new XMLHttpRequest();
	x.open('POST', 'meet');
	x.onreadystatechange = function() {
		if (x.readyState == XMLHttpRequest.DONE) {
			self.sessionId = x.responseText;
			self.sessionCreated();
			self.startAliveHeartbeat();
		}
	}
	x.send('REQUEST_SESSION');
}