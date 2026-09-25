"use client";

import * as React from "react";

interface UseMaskingOptions {
  /** Se true, dados começam mascarados (padrão: true) */
  maskedByDefault?: boolean;
  /** Tempo em ms para re-ocultar automaticamente (padrão: 30000) */
  autoHideMs?: number;
}

interface UseMaskingReturn {
  /** Se os dados estão visíveis */
  isVisible: boolean;
  /** Função para alternar visibilidade */
  toggle: () => void;
  /** Função para mostrar */
  show: () => void;
  /** Função para ocultar */
  hide: () => void;
}

/**
 * Hook para controlar visibilidade de dados sensíveis.
 * Dados ficam mascarados por padrão e re-ocultam automaticamente.
 */
export function useMasking(options: UseMaskingOptions = {}): UseMaskingReturn {
  const { maskedByDefault = true, autoHideMs = 30_000 } = options;
  const [isVisible, setIsVisible] = React.useState(!maskedByDefault);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoHide = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const show = React.useCallback(() => {
    setIsVisible(true);
    clearAutoHide();
    if (autoHideMs > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, autoHideMs);
    }
  }, [autoHideMs, clearAutoHide]);

  const hide = React.useCallback(() => {
    setIsVisible(false);
    clearAutoHide();
  }, [clearAutoHide]);

  const toggle = React.useCallback(() => {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  }, [isVisible, hide, show]);

  React.useEffect(() => {
    return () => clearAutoHide();
  }, [clearAutoHide]);

  return { isVisible, toggle, show, hide };
}
