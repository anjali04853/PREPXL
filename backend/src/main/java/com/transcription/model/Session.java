package com.transcription.model;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Represents a user session for audio transcription.
 *
 * @param id                    Unique session identifier
 * @param connectionId          WebSocket connection identifier
 * @param createdAt             Timestamp when session was created
 * @param state                 Current session state
 * @param transcriptionHistory  List of transcription updates for this session
 */
public record Session(
    String id,
    String connectionId,
    Instant createdAt,
    SessionState state,
    List<TranscriptionUpdate> transcriptionHistory
) {
    /**
     * Creates a new active session.
     */
    public static Session create(String id, String connectionId) {
        return new Session(
            id,
            connectionId,
            Instant.now(),
            SessionState.ACTIVE,
            new CopyOnWriteArrayList<>()
        );
    }

    /**
     * Returns a new session with updated state.
     */
    public Session withState(SessionState newState) {
        return new Session(id, connectionId, createdAt, newState, transcriptionHistory);
    }
}
