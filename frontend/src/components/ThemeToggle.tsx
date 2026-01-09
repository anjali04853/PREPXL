/**
 * ThemeToggle - Accessible theme toggle component
 * 
 * Requirements: 10.4, 10.6
 * - Add ARIA labels for controls
 * - Support theme customization (dark/light/gradient)
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { ColorScheme } from '../types';

export interface ThemeToggleProps {
  /** Additional CSS class name */
  className?: string;
  /** Whether to show labels */
  showLabels?: boolean;
}

const THEME_ICONS: Record<ColorScheme, string> = {
  dark: '🌙',
  light: '☀️',
  gradient: '🌈',
};

const THEME_LABELS: Record<ColorScheme, string> = {
  dark: 'Dark',
  light: 'Light',
  gradient: 'Gradient',
};

/**
 * ThemeToggle component for switching between themes
 */
export function ThemeToggle({ className = '', showLabels = false }: ThemeToggleProps) {
  const { colorScheme, setColorScheme, toggleTheme } = useTheme();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  };

  return (
    <div 
      className={`theme-toggle ${className}`}
      style={styles.container}
      role="group"
      aria-label="Theme selection"
    >
      {/* Simple toggle button */}
      <button
        onClick={toggleTheme}
        onKeyDown={handleKeyDown}
        style={styles.toggleButton}
        aria-label={`Current theme: ${THEME_LABELS[colorScheme]}. Click to change theme.`}
        aria-pressed={false}
        title={`Switch theme (currently ${THEME_LABELS[colorScheme]})`}
      >
        <span style={styles.icon} aria-hidden="true">
          {THEME_ICONS[colorScheme]}
        </span>
        {showLabels && (
          <span style={styles.label}>{THEME_LABELS[colorScheme]}</span>
        )}
      </button>

      {/* Theme selector dropdown (for more control) */}
      <select
        value={colorScheme}
        onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
        style={styles.select}
        aria-label="Select theme"
      >
        <option value="dark">🌙 Dark</option>
        <option value="light">☀️ Light</option>
        <option value="gradient">🌈 Gradient</option>
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: 'var(--color-surface, #1e1e1e)',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--color-text, #fff)',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  icon: {
    fontSize: '18px',
  },
  label: {
    fontSize: '14px',
  },
  select: {
    padding: '8px 12px',
    background: 'var(--color-surface, #1e1e1e)',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    color: 'var(--color-text, #fff)',
    fontSize: '14px',
    cursor: 'pointer',
  },
};

export default ThemeToggle;
