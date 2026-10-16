// Local-calendar selectors retained from the earlier Things shell.
const pad = (n: number) => String(n).padStart(2, '0');

export function localDayKey(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD in local time for a date-only or datetime ISO string. */
export function dayKeyOf(iso?: string): string | undefined {
    if (!iso) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? undefined : localDayKey(d);
}
