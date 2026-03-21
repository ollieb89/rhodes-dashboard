import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    setTheme: vi.fn(),
  }),
}));

describe("keyboard shortcuts help modal", () => {
  it("opens when question mark is pressed", () => {
    render(<KeyboardShortcutsProvider><Sidebar /></KeyboardShortcutsProvider>);

    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "?" });

    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });

  it("closes when escape is pressed", () => {
    render(<KeyboardShortcutsProvider><Sidebar /></KeyboardShortcutsProvider>);

    fireEvent.keyDown(window, { key: "?" });
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();
  });
});
