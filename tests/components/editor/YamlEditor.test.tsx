import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import YamlEditor from "@/components/editor/YamlEditor";

vi.mock("monaco-editor", () => ({}));

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value?: string) => void }) => (
    <textarea aria-label="yaml editor" value={value} onChange={(event) => onChange?.(event.currentTarget.value)} />
  ),
  loader: { config: vi.fn() },
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("YamlEditor", () => {
  it("debounces text changes before notifying the parent", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<YamlEditor value="version: 1" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("yaml editor"), { target: { value: "version: 1\nnodes: []" } });

    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledWith("version: 1\nnodes: []");
  });

  it("flushes a pending edit when unmounted", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { unmount } = render(<YamlEditor value="version: 1" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("yaml editor"), { target: { value: "version: 2" } });
    unmount();

    expect(onChange).toHaveBeenCalledWith("version: 2");
  });

  it("cancels a pending edit when an external value arrives", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(<YamlEditor value="version: 1" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("yaml editor"), { target: { value: "version: 12" } });
    rerender(<YamlEditor value="version: 0" onChange={onChange} />);
    vi.advanceTimersByTime(300);

    expect(screen.getByLabelText("yaml editor")).toHaveValue("version: 0");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("syncs external value changes from the parent", () => {
    const { rerender } = render(<YamlEditor value="version: 1" onChange={vi.fn()} />);

    rerender(<YamlEditor value="version: 2" onChange={vi.fn()} />);

    expect(screen.getByLabelText("yaml editor")).toHaveValue("version: 2");
  });

  it("shows an inline YAML validation error from the parent", () => {
    render(<YamlEditor value="nodes: [" onChange={vi.fn()} error="YAML parse failed" />);

    expect(screen.getByText("YAML parse failed")).toHaveClass("yaml-error");
  });
});
