import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMasking } from "./use-masking";

describe("useMasking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inicia mascarado por padrão", () => {
    const { result } = renderHook(() => useMasking());
    expect(result.current.isVisible).toBe(false);
  });

  it("inicia visível quando maskedByDefault é false", () => {
    const { result } = renderHook(() => useMasking({ maskedByDefault: false }));
    expect(result.current.isVisible).toBe(true);
  });

  it("alterna visibilidade com toggle", () => {
    const { result } = renderHook(() => useMasking());

    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("mostra dados com show()", () => {
    const { result } = renderHook(() => useMasking());

    act(() => {
      result.current.show();
    });
    expect(result.current.isVisible).toBe(true);
  });

  it("oculta dados com hide()", () => {
    const { result } = renderHook(() => useMasking({ maskedByDefault: false }));

    act(() => {
      result.current.hide();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("re-oculta automaticamente após autoHideMs", () => {
    const { result } = renderHook(() =>
      useMasking({ autoHideMs: 5000 }),
    );

    act(() => {
      result.current.show();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("não re-oculta quando autoHideMs é 0", () => {
    const { result } = renderHook(() =>
      useMasking({ autoHideMs: 0 }),
    );

    act(() => {
      result.current.show();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current.isVisible).toBe(true);
  });

  it("limpa timeout ao desmontar", () => {
    const { result, unmount } = renderHook(() =>
      useMasking({ autoHideMs: 5000 }),
    );

    act(() => {
      result.current.show();
    });

    unmount();

    // Não deve lançar erro
    act(() => {
      vi.advanceTimersByTime(5000);
    });
  });

  it("reseta timer ao chamar show() novamente", () => {
    const { result } = renderHook(() =>
      useMasking({ autoHideMs: 5000 }),
    );

    act(() => {
      result.current.show();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isVisible).toBe(true);

    // Chama show() novamente para resetar timer
    act(() => {
      result.current.show();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Ainda deve estar visível (timer resetado)
    expect(result.current.isVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Agora deve ter re-ocultado
    expect(result.current.isVisible).toBe(false);
  });
});
