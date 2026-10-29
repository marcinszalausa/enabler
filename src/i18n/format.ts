// Fills {name} placeholders: fmt("{count} ads", { count: 5 }) is "5 ads".
export function fmt(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in values ? String(values[key]) : m,
  );
}
