import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useApiForm } from "./useApiForm";

describe("useApiForm", () => {
  it("should handle successful submission", async () => {
    const mockSubmitter = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useApiForm(mockSubmitter));

    const [handleSubmit] = result.current;

    await act(async () => {
      await handleSubmit({ test: "data" });
    });

    const [, isSubmitting, error] = result.current;
    expect(mockSubmitter).toHaveBeenCalledWith({ test: "data" });
    expect(isSubmitting).toBe(false);
    expect(error).toBeNull();
  });

  it("should handle submission failure", async () => {
    const error = new Error("API Error");
    const mockSubmitter = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useApiForm(mockSubmitter));

    const [handleSubmit] = result.current;

    await act(async () => {
      await handleSubmit({});
    });

    const [, isSubmitting, finalError] = result.current;
    expect(isSubmitting).toBe(false);
    expect(finalError).toBe("API Error");
  });
});