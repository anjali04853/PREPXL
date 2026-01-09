package com.transcription.service;

import com.transcription.model.Session;
import com.transcription.model.SessionState;
import com.transcription.model.TranscriptionUpdate;

import java.util.Optional;

/**
 * Manages concurrent user sessions for audio transcription.
 * Handles session lifecycle including creation, state transitions, and cleanup.
 */
public interface SessionManager {

    /**
     * Creates a new session for a WebSocket connection.
     *
     * @param connectionId the WebSocket connection identifier
     * @return the newly created session
     */
    Session createSession(String connectionId);

    /**
     * Retrieves a session by its ID.
     *
     * @param sessionId the session identifier
     * @return an Optional containing the session if found, empty otherwise
     */
    Optional<Session> getSession(String sessionId);

    /**
     * Retrieves a session by its connection ID.
     *
     * @param connectionId the WebSocket connection identifier
     * @return an Optional containing the session if found, empty otherwise
     */
    Optional<Session> getSessionByConnectionId(String connectionId);

    /**
     * Updates the state of a session.
     *
     * @param sessionId the session identifier
     * @param newState the new state to transition to
     * @return an Optional containing the updated session if found, empty otherwise
     */
    Optional<Session> updateSessionState(String sessionId, SessionState newState);

    /**
     * Pauses a session, stopping audio processing but maintaining the connection.
     *
     * @param sessionId the session identifier
     * @return an Optional containing the paused session if found and was active, empty otherwise
     */
    Optional<Session> pauseSession(String sessionId);

    /**
     * Resumes a paused session.
     *
     * @param sessionId the session identifier
     * @return an Optional containing the resumed session if found and was paused, empty otherwise
     */
    Optional<Session> resumeSession(String sessionId);

    /**
     * Adds a transcription update to a session's history.
     *
     * @param sessionId the session identifier
     * @param update the transcription update to add
     * @return true if the update was added successfully, false if session not found
     */
    boolean addTranscriptionUpdate(String sessionId, TranscriptionUpdate update);

    /**
     * Closes a session and cleans up resources.
     *
     * @param sessionId the session identifier
     */
    void closeSession(String sessionId);

    /**
     * Gets the count of currently active sessions.
     *
     * @return the number of active sessions
     */
    int getActiveSessionCount();

    /**
     * Checks if a session exists and is in a specific state.
     *
     * @param sessionId the session identifier
     * @param state the state to check for
     * @return true if the session exists and is in the specified state
     */
    boolean isSessionInState(String sessionId, SessionState state);
}
