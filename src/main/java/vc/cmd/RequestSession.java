package vc.cmd;

import vc.MeetSessions;

public class RequestSession extends MeetSessions.Handler {

	public RequestSession(MeetSessions meetSessions) {
		meetSessions.super("REQUEST_SESSION", null);
	}

	@Override
	public String apply(String t, String u) {
		return sessions.registerNewInstance().getSessionId().toString();
	}
}
