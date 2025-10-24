import { UserSession } from "./UserSession.js";

/**
 * In-memory storage for all user sessions.
 *
 * Maps chat_id → UserSession. Auto-creates new session for first-time users.
 */
class SessionStorage {
  private map: Map<number, UserSession>;

  constructor() {
    this.map = new Map();
  }

  // Get existing session or create new one
  get(chat_id: number) {
    const existingSession = this.map.get(chat_id);
    if (existingSession) return existingSession;

    const newSession = new UserSession();
    this.map.set(chat_id, newSession);
    return newSession;
  }
}

export const sessionStorage = new SessionStorage();
