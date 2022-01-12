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
import vc.MeetSessions.MeetSession;

public class Answer extends Handler {

	/**
	 * Serial version UID.
	 */
	private static final long serialVersionUID = -8792144584682939948L;

	public Answer(MeetSessions meetSessions) {
		meetSessions.super("ANSWER:");
	}

	@Override
	public String apply(String command, String headerSessionUUID) {
		String sessionIdAndSDP = command.substring(getKey().length());
		int sep = sessionIdAndSDP.indexOf(':');
		String targetSessionId = sessionIdAndSDP.substring(0, sep);
		String sdp = sessionIdAndSDP.substring(sep + 1);
		return calculate(headerSessionUUID, targetSessionId, sdp);
	}

	private String calculate(String headerSessionUUID, String targetSessionId, String sdp) {
		MeetSession session = sessions.getById(headerSessionUUID);
		MeetSession target = sessions.getById(targetSessionId);
		if (target == null) {
			session.addMessage("FORGET_UNKNOWN_SESSION:" + targetSessionId);
		} else {
			target.addMessage("INCOMMING_ANSWER:" + headerSessionUUID + ":" + sdp);
			sessions.notifyAnswerSent(sdp, target, session);
		}
		return null;
	}
}
