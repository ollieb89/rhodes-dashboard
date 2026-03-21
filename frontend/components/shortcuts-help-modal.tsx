"use client";

import { SHORTCUT_GROUP_ORDER, type ShortcutDefinition } from "@/lib/shortcuts";

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutDefinition[];
}

function renderKeys(shortcut: ShortcutDefinition) {
  return shortcut.keys.map((key, index) => (
    <span key={`${shortcut.id}-${key}-${index}`} className="flex items-center gap-1.5">
      {index > 0 && <span className="text-zinc-600">then</span>}
      <kbd className="min-w-7 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center font-mono text-[11px] uppercase tracking-wide text-zinc-200">
        {key}
      </kbd>
    </span>
  ));
}

export function ShortcutsHelpModal({
  open,
  onClose,
  shortcuts,
}: ShortcutsHelpModalProps) {
  if (!open) {
    return null;
  }

  const groupedShortcuts = SHORTCUT_GROUP_ORDER
    .map((group) => ({
      group,
      items: shortcuts.filter((shortcut) => shortcut.group === group),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 id="keyboard-shortcuts-title" className="text-base font-semibold text-zinc-100">
              Keyboard shortcuts
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Current shortcuts available in Rhodes Command Center.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            autoFocus
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {groupedShortcuts.map(({ group, items }) => (
            <section key={group} className="mb-5 last:mb-0">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {group}
              </h3>
              <div className="space-y-2">
                {items.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                  >
                    <span className="text-sm text-zinc-200">{shortcut.description}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {renderKeys(shortcut)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
