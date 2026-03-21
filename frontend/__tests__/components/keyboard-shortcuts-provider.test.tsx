import { fireEvent, render, screen } from "@testing-library/react";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function KeyboardNavHarness() {
  return (
    <KeyboardShortcutsProvider>
      <div>
        <input aria-label="Plain input" />
        <textarea aria-label="Plain textarea" />
        <select aria-label="Plain select" defaultValue="one">
          <option value="one">One</option>
        </select>
        <div aria-label="Editable region" contentEditable suppressContentEditableWarning>
          Editable region
        </div>
      </div>
    </KeyboardShortcutsProvider>
  );
}

describe("keyboard shortcut navigation", () => {
  beforeEach(() => {
    push.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("keeps existing g plus letter navigation working", () => {
    render(<KeyboardNavHarness />);

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });

    expect(push).toHaveBeenCalledWith("/products");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not navigate once the g chord has expired", () => {
    render(<KeyboardNavHarness />);

    fireEvent.keyDown(window, { key: "g" });
    vi.advanceTimersByTime(1001);
    fireEvent.keyDown(window, { key: "p" });

    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["input", "Plain input"],
    ["textarea", "Plain textarea"],
    ["select", "Plain select"],
    ["contenteditable", "Editable region"],
  ])("does not trigger shortcuts while typing in %s", (_kind, label) => {
    render(<KeyboardNavHarness />);

    const field = screen.getByLabelText(label);
    if (_kind === "contenteditable") {
      Object.defineProperty(field, "isContentEditable", {
        value: true,
        configurable: true,
      });
    }
    fireEvent.keyDown(field, { key: "g" });
    fireEvent.keyDown(field, { key: "p" });

    expect(push).not.toHaveBeenCalled();
  });
});
