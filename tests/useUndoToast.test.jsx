import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUndoToast } from "../src/hooks/useUndoToast.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useUndoToast", () => {
  it("shows a toast and clears it after the duration", () => {
    const { result } = renderHook(() => useUndoToast(1000));
    act(() => result.current.showUndo("Food removed", () => {}));
    expect(result.current.toast?.message).toBe("Food removed");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toast).toBeNull();
  });

  it("runs the restore callback on undo and clears the toast", () => {
    const restore = vi.fn();
    const { result } = renderHook(() => useUndoToast(5000));
    act(() => result.current.showUndo("Session deleted", restore));
    act(() => result.current.undo());
    expect(restore).toHaveBeenCalledTimes(1);
    expect(result.current.toast).toBeNull();
  });

  it("dismiss clears the toast without running the callback", () => {
    const restore = vi.fn();
    const { result } = renderHook(() => useUndoToast(5000));
    act(() => result.current.showUndo("Set removed", restore));
    act(() => result.current.dismiss());
    expect(restore).not.toHaveBeenCalled();
    expect(result.current.toast).toBeNull();
  });

  it("a new toast replaces a pending one instead of stacking", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useUndoToast(5000));
    act(() => result.current.showUndo("First", first));
    act(() => result.current.showUndo("Second", second));
    expect(result.current.toast?.message).toBe("Second");
    act(() => result.current.undo());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
