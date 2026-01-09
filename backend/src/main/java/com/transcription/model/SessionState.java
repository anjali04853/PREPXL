package com.transcription.model;

/**
 * State of a transcription session.
 */
public enum SessionState {
    /** Session is actively receiving and processing audio */
    ACTIVE,
    /** Session is paused, maintaining connection but not processing */
    PAUSED,
    /** Session has been closed and cleaned up */
    CLOSED
}
