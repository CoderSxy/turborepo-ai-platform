export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function handleFocusTrapKeyDown(
  container: HTMLElement,
  event: KeyboardEvent,
): void {
  if (event.key !== "Tab") {
    return;
  }

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;

  if (event.shiftKey) {
    if (!active || !container.contains(active) || active === first) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (!active || !container.contains(active) || active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function focusInitialElement(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  (focusable[0] ?? container).focus();
}
