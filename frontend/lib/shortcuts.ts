export type ShortcutGroup = "General" | "Navigation";

export interface ShortcutDefinition {
  id: string;
  group: ShortcutGroup;
  description: string;
  keys: string[];
  href?: string;
  label?: string;
}

export interface NavigationShortcutDefinition extends ShortcutDefinition {
  href: string;
  label: string;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "command-palette",
    group: "General",
    description: "Open command palette",
    keys: ["Cmd/Ctrl", "K"],
  },
  {
    id: "shortcuts-help",
    group: "General",
    description: "Open keyboard shortcuts help",
    keys: ["?"],
  },
  {
    id: "dismiss-active-ui",
    group: "General",
    description: "Close or dismiss",
    keys: ["Esc"],
  },
  {
    id: "nav-overview",
    group: "Navigation",
    description: "Go to Overview",
    keys: ["g", "o"],
    href: "/",
    label: "Overview",
  },
  {
    id: "nav-products",
    group: "Navigation",
    description: "Go to Products",
    keys: ["g", "p"],
    href: "/products",
    label: "Products",
  },
  {
    id: "nav-content",
    group: "Navigation",
    description: "Go to Content",
    keys: ["g", "c"],
    href: "/content",
    label: "Content",
  },
  {
    id: "nav-agents",
    group: "Navigation",
    description: "Go to Agents",
    keys: ["g", "a"],
    href: "/agents",
    label: "Agents",
  },
  {
    id: "nav-metrics",
    group: "Navigation",
    description: "Go to Metrics",
    keys: ["g", "m"],
    href: "/metrics",
    label: "Metrics",
  },
  {
    id: "nav-delivery",
    group: "Navigation",
    description: "Go to Delivery",
    keys: ["g", "d"],
    href: "/delivery",
    label: "Delivery",
  },
  {
    id: "nav-incidents",
    group: "Navigation",
    description: "Go to Incidents",
    keys: ["g", "i"],
    href: "/incidents",
    label: "Incidents",
  },
  {
    id: "nav-settings",
    group: "Navigation",
    description: "Go to Settings",
    keys: ["g", "s"],
    href: "/settings",
    label: "Settings",
  },
];

export const NAVIGATION_SHORTCUTS = SHORTCUTS.filter(
  (shortcut): shortcut is NavigationShortcutDefinition =>
    shortcut.group === "Navigation" &&
    typeof shortcut.href === "string" &&
    typeof shortcut.label === "string"
);

export const NAVIGATION_SHORTCUT_MAP = Object.fromEntries(
  NAVIGATION_SHORTCUTS.map((shortcut) => [shortcut.keys[1], shortcut.href!])
);

export const SHORTCUT_GROUP_ORDER: ShortcutGroup[] = ["General", "Navigation"];
