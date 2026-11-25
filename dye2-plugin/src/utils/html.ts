/**
 * Tagged template literal for HTML strings.
 * Provides a visual marker for syntax highlighting in editors.
 * Does NOT escape interpolated values — browser scripts use esc() from devApiScript.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  return strings.reduce((result, str, i) => {
    const value = i < values.length ? String(values[i]) : "";
    return result + str + value;
  }, "");
}

