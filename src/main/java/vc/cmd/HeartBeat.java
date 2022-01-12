/**       ___Copyright_ 2021 ___ by  _ Peter Rader _____ _ www.      _
 *       |__ \       \ \    / (_)   | |           / ____| | e-nexus | |
 *  _ __    ) |_ __ __\ \  / / _  __| | ___  ___ | |    | |__.de__ _| |_
 * | '_ \  / /| '_ ` _ \ \/ / | |/ _` |/ _ \/ _ \| |    | '_ \ / _` | __|
 * | | | |/ /_| | | | | \  /  | | (_| |  __/ (_) | |____| | | | (_| | |_
 * |_| |_|____|_| |_| |_|\/   |_|\__,_|\___|\___/ \_____|_| |_|\__,_|\__|
 */
package vc.cmd;

import vc.MeetSessions;
import vc.MeetSessions.Handler;
import vc.MeetSessions.MeetConnection;
import vc.MeetSessions.MeetSession;

public class HeartBeat extends Handler {

	/**
	 * Serial version UID.
	 */
	private static final long serialVersionUID = 6545874681501369379L;

	public HeartBeat(MeetSessions meetSessions) {
		meetSessions.super("HEARTBEAT");
	}

	@Override
	public String apply(String command, String headerSessionUUID) {
		MeetSession session = sessions.getById(headerSessionUUID);
		if (session != null) {
			session.notifyAlive();
			synchronized (sessions) {
				for (MeetSession missingSession : sessions.connectionsMissingToWhatSession(session)) {
					MeetConnection c = sessions.new MeetConnection(session, missingSession);
					session.addMessage("CREATE_OFFER:" + c.getAnswerer().getSessionId());
				}
			}
			String result = "";
			for (String message : session.copyMessageQueueAndClear()) {
				result += message + "\n";
			}
			return result;
		}
		return null;
	}
}
