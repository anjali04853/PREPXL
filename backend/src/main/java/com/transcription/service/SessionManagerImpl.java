package com.transcription.service;

import com.transcription.model.Session;
import com.transcription.model.SessionState;
import com.transcription.model.TranscriptionUpdate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe implementation of SessionManager for managing concurrent transcription sessions.
 * Uses ConcurrentHashMap for thread-safe session storage and operations.
 */
@Service
public class SessionManagerImpl implements SessionManager {

    private static final Logger log = LoggerFactory.getLogger(SessionManagerImpl.class);

    private final Map<String, Session> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, String> connectionToSessionId = new ConcurrentHashMap<>();

    @Override
    public Session createSession(String connectionId) {
        String sessionId = UUID.randomUUID().toString();
        Session session = Session.create(sessionId, connectionId);
        
        sessionsById.put(sessionId, session);
        connectionToSessionId.put(connectionId, sessionId);
        
        log.info("Created session {} for connection {}", sessionId, connectionId);
        return session;
    }

    @Override
    public Optional<Session> getSession(String sessionId) {
        return Optional.ofNullable(sessionsById.get(sessionId));
    }

    @Override
    public Optional<Session> getSessionByConnectionId(String connectionId) {
        String sessionId = connectionToSessionId.get(connectionId);
        if (sessionId == null) {
            return Optional.empty();
        }
        return getSession(sessionId);
    }

    @Override
    public Optional<Session> updateSessionState(String sessionId, SessionState newState) {
        return Optional.ofNullable(sessionsById.computeIfPresent(sessionId, (id, session) -> {
            SessionState oldState = session.state();
            if (isValidStateTransition(oldState, newState)) {
                Session updatedSession = session.withState(newState);
                log.info("Session {} state changed: {} -> {}", sessionId, oldState, newState);
                return updatedSession;
            } else {
                log.warn("Invalid state transition for session {}: {} -> {}", sessionId, oldState, newState);
                return session;
            }
        }));
    }

    @Override
    public Optional<Session> pauseSession(String sessionId) {
        return getSession(sessionId)
            .filter(session -> session.state() == SessionState.ACTIVE)
            .flatMap(session -> updateSessionState(sessionId, SessionState.PAUSED));
    }

    @Override
    public Optional<Session> resumeSession(String sessionId) {
        return getSession(sessionId)
            .filter(session -> session.state() == SessionState.PAUSED)
            .flatMap(session -> updateSessionState(sessionId, SessionState.ACTIVE));
    }

    @Override
    public boolean addTranscriptionUpdate(String sessionId, TranscriptionUpdate update) {
        Session session = sessionsById.get(sessionId);
        if (session != null && session.state() != SessionState.CLOSED) {
            session.transcriptionHistory().add(update);
            log.debug("Added transcription update to session {}: sequenceId={}", sessionId, update.sequenceId());
            return true;
        }
        return false;
    }

    @Override
    public void closeSession(String sessionId) {
        Session session = sessionsById.get(sessionId);
        if (session != null) {
            // Update state to CLOSED
            sessionsById.computeIfPresent(sessionId, (id, s) -> s.withState(SessionState.CLOSED));
            
            // Remove from maps
            sessionsById.remove(sessionId);
            connectionToSessionId.remove(session.connectionId());
            
            log.info("Closed session {} with {} transcription updates", 
                sessionId, session.transcriptionHistory().size());
        }
    }

    @Override
    public int getActiveSessionCount() {
        return (int) sessionsById.values().stream()
            .filter(session -> session.state() == SessionState.ACTIVE)
            .count();
    }

    @Override
    public boolean isSessionInState(String sessionId, SessionState state) {
        return getSession(sessionId)
            .map(session -> session.state() == state)
            .orElse(false);
    }

    /**
     * Validates if a state transition is allowed.
     * Valid transitions:
     * - ACTIVE -> PAUSED
     * - ACTIVE -> CLOSED
     * - PAUSED -> ACTIVE
     * - PAUSED -> CLOSED
     */
    private boolean isValidStateTransition(SessionState from, SessionState to) {
        if (from == to) {
            return true; // No-op transition is allowed
        }
        
        return switch (from) {
            case ACTIVE -> to == SessionState.PAUSED || to == SessionState.CLOSED;
            case PAUSED -> to == SessionState.ACTIVE || to == SessionState.CLOSED;
            case CLOSED -> false; // Cannot transition from CLOSED
        };
    }
}
