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

public class OfferSDP extends Handler {

	/**
	 * Serial version UID.
	 */
	private static final long serialVersionUID = 9161815325762415860L;

	public OfferSDP(MeetSessions meetSessions) {
		meetSessions.super("OFFER_SDP:");
	}

	@Override
	public String apply(String command, String headerSessionUUID) {
		MeetSession session = sessions.getById(headerSessionUUID);
		if (session == null) {
			return null;
		}
		String sessionIdAndSDP = command.substring(getKey().length());
		int sep = sessionIdAndSDP.indexOf(':');
		String targetSessionId = sessionIdAndSDP.substring(0, sep);
		String sdp = sessionIdAndSDP.substring(sep + 1);
		return calculate(headerSessionUUID, session, targetSessionId, sdp);
	}

	private String calculate(String headerSessionUUID, MeetSession session, String targetSessionId, String sdp) {
		MeetSession byId = sessions.getById(targetSessionId);
		if (byId == null) {
			session.addMessage("FORGET_UNKNOWN_SESSION:" + targetSessionId);
		} else {
			byId.addMessage("INCOMMING_OFFER:" + headerSessionUUID + ":" + sdp);
			sessions.notifyOfferSent(sdp, session, byId);
		}
		return null;
	}
}
