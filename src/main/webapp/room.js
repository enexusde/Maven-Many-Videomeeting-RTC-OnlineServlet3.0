function Connection(webcam, stunUrl) {
	var self = this;
	self.webcam = webcam;
	self.stunUrl = stunUrl;
	self.streamEventsChangedHandler = [];
	self.peerConn = new RTCPeerConnection({ iceServers: [{ urls: self.stunUrl }] });
	self.peerConn.ontrack = (event) => {
		for (var i = 0; i < self.streamEventsChangedHandler.length; i++) {
			self.streamEventsChangedHandler[i](event);
		}
	};
	self.webcam.getTracks().forEach((track) => self.peerConn.addTrack(track));
	self.createOffer = function(callback) {
		self.peerConn.onicecandidate = function(event) {
			if (event.candidate) {
			} else {
				callback(self.peerConn.localDescription.sdp);
			}
		};
		self.peerConn.createOffer().then((des) => {
			return self.peerConn.setLocalDescription(des);
		});
	};
	self.notifyAnswer = function(answerSDP) {
		self.peerConn.setRemoteDescription(
			new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
		);
	};
	self.notifyOffer = function(offerSDP, callback) {
		self.peerConn.onicecandidate = function(event) {
			if (event.candidate) {
			} else {
				callback();
			}
		};
		self.peerConn
			.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSDP }))
			.then(function() {
				self.peerConn.createAnswer().then(function(answer) {
					self.peerConn.setLocalDescription(answer);
				});
			});
	};
	self.createAnswerSDP = function(callback) {
		callback(self.peerConn.localDescription.sdp);
	};
	self.addOnStreamEventsChangedHandler = function(handler) {
		self.streamEventsChangedHandler.push(handler);
	};
}
function OLEConnection(connection) {
	var self = this;
	self.connection = connection;
	self.createOffer = function(callback) {
		return self.connection.createOffer((sdp) => callback(btoa(JSON.stringify(sdp))));
	};
	self.notifyOffer = function(offerSDP, callback) {
		return self.connection.notifyOffer(JSON.parse(atob(offerSDP)), callback);
	};
	self.notifyAnswer = function(answerSDP) {
		return self.connection.notifyAnswer(JSON.parse(atob(answerSDP)));
	};
	self.createAnswerSDP = function(callback) {
		return self.connection.createAnswerSDP(function(sdp) {
			callback(btoa(JSON.stringify(sdp)));
		});
	};
	self.addOnStreamEventsChangedHandler = function(handler) {
		self.connection.addOnStreamEventsChangedHandler(handler);
	};
}
function Room(stunUrl) {
	var self = this;
	self.sessionId = null;
	self.webcam = null;
	self.lastAliveSent = null;
	self.pcs = {};
	self.onSessionIncommingHandlers = [];
	self.onSessionOutgoingHandlers = [];
	self.onStartStreamHandlers = [];
	self.stunUrl = stunUrl;
	self.triggerHeartBeat = function() {
		var x = new XMLHttpRequest();
		x.open('POST', 'meet');
		x.setRequestHeader('X-session', self.sessionId);
		x.onreadystatechange = function() {
			if (x.readyState == XMLHttpRequest.DONE) {
				self.lastAliveSent = new Date();
				let resp = x.responseText.trim();
				if (!!resp) {
					// console.log('HeartBeatResponse: ' + x.responseText);
					var commandLines = resp.split('\n');
					for (var i = 0; i < commandLines.length; i++) {
						self.executeCommandLine(commandLines[i]);
					}
				}
			}
		};
		x.send('HEARTBEAT');
	};

	self.executeCommandLine = function(commandLine) {
		if (commandLine.indexOf('FORGET_UNKNOWN_SESSION:') == 0) {
			var outgoingSessionId = commandLine.substring(23);
			delete self.pcs[outgoingSessionId];
			for (var i = 0; i < self.onSessionOutgoingHandlers.length; i++) {
				self.onSessionOutgoingHandlers[i](outgoingSessionId);
			}
		} else if (commandLine.indexOf('ADD:') == 0) {
			var incommingSessionId = commandLine.substring(4);
			var h = self.onSessionIncommingHandlers;
			let oleRecipient = new OLEConnection(new Connection(self.webcam, self.stunUrl));
			self.pcs[incommingSessionId] = oleRecipient;

			for (var i = 0; i < h.length; i++) {
				h[i](incommingSessionId, self.pcs[incommingSessionId]);
			}
		} else if (commandLine.indexOf('CREATE_OFFER:') == 0) {
			var forSessionId = commandLine.substring(13);
			let oleSender = self.pcs[forSessionId];
			oleSender.createOffer(function(createdOLESDP) {
				var x = new XMLHttpRequest();
				x.open('POST', 'meet');
				x.setRequestHeader('X-session', self.sessionId);
				x.onreadystatechange = function() {
					if (x.readyState == XMLHttpRequest.DONE) {
						self.lastAliveSent = new Date();
						for (var i = 0; i < self.onStartStreamHandlers.length; i++) {
							self.onStartStreamHandlers[i];
						}
					}
				};
				x.send('OFFER_SDP:' + forSessionId + ':' + createdOLESDP);
			});
		} else if (commandLine.indexOf('INCOMMING_OFFER:') == 0) {
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
					};
					x.send('ANSWER:' + fromSessionId + ':' + sdp);
				});
			});
		} else if (commandLine.indexOf('REM:') == 0) {
			var outgoingSessionId = commandLine.substring(4);
			delete self.pcs[outgoingSessionId];
			for (var i = 0; i < self.onSessionOutgoingHandlers.length; i++) {
				self.onSessionOutgoingHandlers[i](outgoingSessionId);
			}
		} else if (commandLine.indexOf('INCOMMING_ANSWER:') == 0) {
			var answeringSessionIdAndSDF = commandLine.substring(17);
			var colonPos = answeringSessionIdAndSDF.indexOf(':');
			var answeringSessionId = answeringSessionIdAndSDF.substring(0, colonPos);
			var answeringSDP = answeringSessionIdAndSDF.substring(colonPos + 1);
			var oleSender = self.pcs[answeringSessionId];
			if (oleSender) oleSender.notifyAnswer(answeringSDP);
		} else if (commandLine == '') {
		} else {
			console.log('Message unknown: ', commandLine);
		}
	};
	self.startAliveHeartbeat = function() {
		window.setInterval(self.triggerHeartBeat, 1000);
	};
	self.sessionCreated = function() {
		navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function(cam) {
			self.webcam = cam;
		});
	};
	self.addOnSessionIncomming = function(h) {
		self.onSessionIncommingHandlers.push(h);
	};
	self.addOnSessionOutgoing = function(h) {
		self.onSessionOutgoingHandlers.push(h);
	};
	self.addOnStartStream = function(h) {
		self.onStartStreamHandlers.push(h);
	};
	self.start = function(callback) {
		var x = new XMLHttpRequest();
		x.open('POST', 'meet');
		x.onreadystatechange = function() {
			if (x.readyState == XMLHttpRequest.DONE) {
				self.sessionId = x.responseText;
				self.sessionCreated();
				self.startAliveHeartbeat();
				if (typeof callback == 'function') {
					callback(self);
				}
			}
		};
		x.send('REQUEST_SESSION');
	}
}
