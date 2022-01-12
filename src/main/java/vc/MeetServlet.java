/**       ___Copyright_ 2021 ___ by  _ Peter Rader _____ _ www.      _
 *       |__ \       \ \    / (_)   | |           / ____| | e-nexus | |
 *  _ __    ) |_ __ __\ \  / / _  __| | ___  ___ | |    | |__.de__ _| |_
 * | '_ \  / /| '_ ` _ \ \/ / | |/ _` |/ _ \/ _ \| |    | '_ \ / _` | __|
 * | | | |/ /_| | | | | \  /  | | (_| |  __/ (_) | |____| | | | (_| | |_
 * |_| |_|____|_| |_| |_|\/   |_|\__,_|\___|\___/ \_____|_| |_|\__,_|\__|
 */
package vc;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import vc.MeetSessions.MeetSession;

@WebServlet(urlPatterns = "/meet", name = "meetServlet")
public class MeetServlet extends HttpServlet {

	/**
	 * Serial version UID.
	 */
	private static final long serialVersionUID = -2603344696343198587L;

	@Override
	public void destroy() {
		removeOldSessionsThread.interrupt();
	}

	private final MeetSessions sessions = new MeetSessions();
	private Thread removeOldSessionsThread = new Thread(() -> {
		while (!Thread.currentThread().isInterrupted()) {
			try {
				Thread.sleep(200);
			} catch (InterruptedException ie) {
				// Maybe shutdown called.
				break;
			}
			try {
				sessions.removeSessionsOlderThan(System.currentTimeMillis() - 2_000);
			} catch (Exception e) {
				e.printStackTrace(System.err);
			}
		}
	});

	public MeetServlet() {
		sessions.addOnIncommingBrowserTabHandler((me, others) -> {
			for (MeetSession other : others) {
				if (me != other) {
					other.addMessage("ADD:" + me.getSessionId());
					me.addMessage("ADD:" + other.getSessionId());
				}
			}
		});
		sessions.addTooOldBrowserTabHandler((me, others) -> {
			for (MeetSession other : others) {
				if (me != other) {
					other.addMessage("REM:" + me.getSessionId());
					me.addMessage("REM:" + other.getSessionId());
				}
			}
		});
		removeOldSessionsThread.start();
	}

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		resp.setHeader("refresh", "3");
		resp.getWriter().write(sessions.getDebugInfo());
	}

	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		String command = req.getReader().readLine();
		String headerSessionUUID = req.getHeader("X-session");
		String result = sessions.execute(command, headerSessionUUID);
		if (result != null) {
			resp.getWriter().write(result);
		}
	}
}
