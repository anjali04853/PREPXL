package com.transcription.config;

import com.transcription.handler.AudioWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.HandlerMapping;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;
import org.springframework.web.reactive.socket.server.support.WebSocketHandlerAdapter;

import java.util.Map;

/**
 * Configuration for WebSocket support in the application.
 * Sets up the WebSocket handler mapping and adapter.
 */
@Configuration
public class WebSocketConfig {

    @Value("${websocket.path:/ws/transcription}")
    private String websocketPath;

    @Bean
    public HandlerMapping webSocketHandlerMapping(AudioWebSocketHandler audioWebSocketHandler) {
        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setUrlMap(Map.of(websocketPath, audioWebSocketHandler));
        mapping.setOrder(-1); // High priority
        return mapping;
    }

    @Bean
    public WebSocketHandlerAdapter webSocketHandlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
