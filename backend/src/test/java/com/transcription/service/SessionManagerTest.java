package com.transcription.service;

import com.transcription.model.Session;
import com.transcription.model.SessionState;
import com.transcription.model.TranscriptionUpdate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for SessionManager implementation.
 * Tests session creation, retrieval, state transitions, and concurrent access.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */
class SessionManagerTest {

    private SessionManager sessionManager;

    @BeforeEach
    void setUp() {
        sessionManager = new SessionManagerImpl();
    }

    // ==================== Session Creation and Retrieval Tests ====================

    @Test
    @DisplayName("Should create a new session with ACTIVE state")
    void createSession_shouldCreateActiveSession() {
        String connectionId = "conn-123";
        
        Session session = sessionManager.createSession(connectionId);
        
        assertNotNull(session);
        assertNotNull(session.id());
        assertEquals(connectionId, session.connectionId());
        assertEquals(SessionState.ACTIVE, session.state());
        assertNotNull(session.createdAt());
        assertTrue(session.transcriptionHistory().isEmpty());
    }

    @Test
    @DisplayName("Should retrieve session by ID")
    void getSession_shouldReturnSessionById() {
        String connectionId = "conn-456";
        Session created = sessionManager.createSession(connectionId);
        
        Optional<Session> retrieved = sessionManager.getSession(created.id());
        
        assertTrue(retrieved.isPresent());
        assertEquals(created.id(), retrieved.get().id());
    }

    @Test
    @DisplayName("Should return empty for non-existent session ID")
    void getSession_shouldReturnEmptyForNonExistent() {
        Optional<Session> result = sessionManager.getSession("non-existent-id");
        
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Should retrieve session by connection ID")
    void getSessionByConnectionId_shouldReturnSession() {
        String connectionId = "conn-789";
        Session created = sessionManager.createSession(connectionId);
        
        Optional<Session> retrieved = sessionManager.getSessionByConnectionId(connectionId);
        
        assertTrue(retrieved.isPresent());
        assertEquals(created.id(), retrieved.get().id());
    }

    @Test
    @DisplayName("Should return empty for non-existent connection ID")
    void getSessionByConnectionId_shouldReturnEmptyForNonExistent() {
        Optional<Session> result = sessionManager.getSessionByConnectionId("non-existent-conn");
        
        assertTrue(result.isEmpty());
    }

    // ==================== State Transition Tests ====================

    @Test
    @DisplayName("Should pause an active session")
    void pauseSession_shouldTransitionFromActiveTopaused() {
        Session session = sessionManager.createSession("conn-1");
        
        Optional<Session> paused = sessionManager.pauseSession(session.id());
        
        assertTrue(paused.isPresent());
        assertEquals(SessionState.PAUSED, paused.get().state());
    }

    @Test
    @DisplayName("Should not pause an already paused session")
    void pauseSession_shouldNotPauseAlreadyPausedSession() {
        Session session = sessionManager.createSession("conn-2");
        sessionManager.pauseSession(session.id());
        
        Optional<Session> result = sessionManager.pauseSession(session.id());
        
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Should resume a paused session")
    void resumeSession_shouldTransitionFromPausedToActive() {
        Session session = sessionManager.createSession("conn-3");
        sessionManager.pauseSession(session.id());
        
        Optional<Session> resumed = sessionManager.resumeSession(session.id());
        
        assertTrue(resumed.isPresent());
        assertEquals(SessionState.ACTIVE, resumed.get().state());
    }

    @Test
    @DisplayName("Should not resume an active session")
    void resumeSession_shouldNotResumeActiveSession() {
        Session session = sessionManager.createSession("conn-4");
        
        Optional<Session> result = sessionManager.resumeSession(session.id());
        
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Should close an active session")
    void closeSession_shouldCloseActiveSession() {
        Session session = sessionManager.createSession("conn-5");
        
        sessionManager.closeSession(session.id());
        
        Optional<Session> result = sessionManager.getSession(session.id());
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Should close a paused session")
    void closeSession_shouldClosePausedSession() {
        Session session = sessionManager.createSession("conn-6");
        sessionManager.pauseSession(session.id());
        
        sessionManager.closeSession(session.id());
        
        Optional<Session> result = sessionManager.getSession(session.id());
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Should check if session is in specific state")
    void isSessionInState_shouldReturnCorrectState() {
        Session session = sessionManager.createSession("conn-7");
        
        assertTrue(sessionManager.isSessionInState(session.id(), SessionState.ACTIVE));
        assertFalse(sessionManager.isSessionInState(session.id(), SessionState.PAUSED));
        
        sessionManager.pauseSession(session.id());
        
        assertFalse(sessionManager.isSessionInState(session.id(), SessionState.ACTIVE));
        assertTrue(sessionManager.isSessionInState(session.id(), SessionState.PAUSED));
    }

    // ==================== Transcription History Tests ====================

    @Test
    @DisplayName("Should add transcription update to session")
    void addTranscriptionUpdate_shouldAddToHistory() {
        Session session = sessionManager.createSession("conn-8");
        TranscriptionUpdate update = TranscriptionUpdate.partial("Hello", 0.95, 1);
        
        boolean added = sessionManager.addTranscriptionUpdate(session.id(), update);
        
        assertTrue(added);
        Optional<Session> retrieved = sessionManager.getSession(session.id());
        assertTrue(retrieved.isPresent());
        assertEquals(1, retrieved.get().transcriptionHistory().size());
        assertEquals("Hello", retrieved.get().transcriptionHistory().get(0).text());
    }

    @Test
    @DisplayName("Should not add transcription to non-existent session")
    void addTranscriptionUpdate_shouldReturnFalseForNonExistent() {
        TranscriptionUpdate update = TranscriptionUpdate.partial("Test", 0.9, 1);
        
        boolean added = sessionManager.addTranscriptionUpdate("non-existent", update);
        
        assertFalse(added);
    }

    // ==================== Active Session Count Tests ====================

    @Test
    @DisplayName("Should return correct active session count")
    void getActiveSessionCount_shouldReturnCorrectCount() {
        assertEquals(0, sessionManager.getActiveSessionCount());
        
        sessionManager.createSession("conn-a");
        assertEquals(1, sessionManager.getActiveSessionCount());
        
        Session session2 = sessionManager.createSession("conn-b");
        assertEquals(2, sessionManager.getActiveSessionCount());
        
        sessionManager.pauseSession(session2.id());
        assertEquals(1, sessionManager.getActiveSessionCount());
    }

    // ==================== Concurrent Access Tests ====================

    @Test
    @DisplayName("Should handle concurrent session creation")
    void concurrentSessionCreation_shouldBeThreadSafe() throws InterruptedException {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    Session session = sessionManager.createSession("conn-concurrent-" + index);
                    if (session != null && session.id() != null) {
                        successCount.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(threadCount, successCount.get());
    }

    @Test
    @DisplayName("Should handle concurrent state transitions")
    void concurrentStateTransitions_shouldBeThreadSafe() throws InterruptedException {
        Session session = sessionManager.createSession("conn-concurrent-state");
        int threadCount = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final boolean shouldPause = i % 2 == 0;
            executor.submit(() -> {
                try {
                    if (shouldPause) {
                        sessionManager.pauseSession(session.id());
                    } else {
                        sessionManager.resumeSession(session.id());
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        // Session should still exist and be in a valid state
        Optional<Session> result = sessionManager.getSession(session.id());
        assertTrue(result.isPresent());
        assertTrue(result.get().state() == SessionState.ACTIVE || 
                   result.get().state() == SessionState.PAUSED);
    }

    @Test
    @DisplayName("Should handle concurrent transcription updates")
    void concurrentTranscriptionUpdates_shouldBeThreadSafe() throws InterruptedException {
        Session session = sessionManager.createSession("conn-concurrent-updates");
        int threadCount = 50;
        ExecutorService executor = Executors.newFixedThreadPool(10);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    TranscriptionUpdate update = TranscriptionUpdate.partial(
                        "Text " + index, 0.9, index);
                    if (sessionManager.addTranscriptionUpdate(session.id(), update)) {
                        successCount.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(threadCount, successCount.get());
        Optional<Session> result = sessionManager.getSession(session.id());
        assertTrue(result.isPresent());
        assertEquals(threadCount, result.get().transcriptionHistory().size());
    }
}
