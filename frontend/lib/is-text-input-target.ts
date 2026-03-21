export function isTextInputTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;

  if (!element) {
    return false;
  }

  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
}
