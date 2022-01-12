/**       ___Copyright_ 2021 ___ by  _ Peter Rader _____ _ www.      _
 *       |__ \       \ \    / (_)   | |           / ____| | e-nexus | |
 *  _ __    ) |_ __ __\ \  / / _  __| | ___  ___ | |    | |__.de__ _| |_
 * | '_ \  / /| '_ ` _ \ \/ / | |/ _` |/ _ \/ _ \| |    | '_ \ / _` | __|
 * | | | |/ /_| | | | | \  /  | | (_| |  __/ (_) | |____| | | | (_| | |_
 * |_| |_|____|_| |_| |_|\/   |_|\__,_|\___|\___/ \_____|_| |_|\__,_|\__|
 */
package vc.cmd;

import vc.MeetSessions;

public class RequestSession extends MeetSessions.Handler {

	/**
	 * Serial version UID.
	 */
	private static final long serialVersionUID = 6813928670352094064L;

	public RequestSession(MeetSessions meetSessions) {
		meetSessions.super("REQUEST_SESSION");
	}

	@Override
	public String apply(String t, String u) {
		return sessions.registerNewInstance().getSessionId().toString();
	}
}
