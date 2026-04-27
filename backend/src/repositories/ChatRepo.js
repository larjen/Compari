/**
 * @module ChatRepo
 * @description Data Access Layer for persistent chat history.
 */
class ChatRepo {
    constructor({ db }) {
        this.db = db;
    }

    /**
     * Retrieves chat history for a specific session.
     * @param {string} sessionId - Unique identifier for the conversation context.
     */
    getHistory(sessionId = 'default') {
        return this.db.prepare('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC').all(sessionId);
    }

    addMessage(role, content, sessionId = 'default') {
        return this.db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(sessionId, role, content);
    }

    clearHistory(sessionId = 'default') {
        return this.db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
    }
}

module.exports = ChatRepo;