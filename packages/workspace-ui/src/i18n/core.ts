import { enUS, zhCN, type TranslationKey } from "./catalogues.ts";

export type Locale = "zh-CN" | "en-US";
export type TranslationParams = Record<string, string | number>;
export type TranslationValue = string | { one: string; other: string };
export type Catalogue = Readonly<Record<string, TranslationValue>>;
export type Catalogues = Readonly<Partial<Record<Locale, Catalogue>>>;
export const LOCALE_STORAGE_KEY = "devungeon.locale.v1";

export function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en-US";
}

const resources: Catalogues = { "zh-CN": zhCN, "en-US": enUS };
const placeholderPattern = /\{([^{}\s]+)\}/g;
const owns = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key);

function validValue(value: unknown): value is TranslationValue {
  if (typeof value === "string") return value.trim().length > 0;
  if (!value || typeof value !== "object") return false;
  const plural = value as Record<string, unknown>;
  return (
    Object.keys(plural).length === 2 &&
    typeof plural.one === "string" &&
    plural.one.trim().length > 0 &&
    typeof plural.other === "string" &&
    plural.other.trim().length > 0
  );
}

/** Injectable resources keep failure-path tests independent of production copy.
 * Application callers use translate(), whose keys are the finite catalogue union.
 * Warnings contain only a static diagnostic and key, never interpolation values.
 */
export function createTranslator(
  catalogues: Catalogues,
  warn: (...args: string[]) => void = (...args) => console.warn(...args),
) {
  return (locale: Locale, key: string, params?: TranslationParams): string => {
    const catalogue = catalogues[locale];
    let resourceLocale = locale;
    let value: unknown =
      catalogue && owns(catalogue, key) ? catalogue[key] : undefined;
    if (!validValue(value)) {
      warn("[i18n] Missing translation", key);
      const fallback = catalogues["zh-CN"];
      value = fallback && owns(fallback, key) ? fallback[key] : undefined;
      resourceLocale = "zh-CN";
    }
    if (!validValue(value)) return `[${key}]`;
    let template: string;
    if (typeof value === "string") {
      template = value;
    } else {
      const supplied =
        params && owns(params, "count") ? params.count : undefined;
      const count =
        typeof supplied === "number"
          ? supplied
          : typeof supplied === "string" && supplied.trim()
            ? Number(supplied)
            : NaN;
      if (!Number.isFinite(count))
        warn("[i18n] Missing or invalid plural count", key);
      const form = new Intl.PluralRules(resourceLocale).select(count);
      template = form === "one" ? value.one : value.other;
    }
    let missing = false;
    const rendered = template.replace(
      placeholderPattern,
      (literal, name: string) => {
        if (
          !params ||
          !owns(params, name) ||
          (typeof params[name] !== "string" && typeof params[name] !== "number")
        ) {
          missing = true;
          return literal;
        }
        // A replacement callback preserves literal $&, $1, braces and source text.
        return String(params[name]);
      },
    );
    if (missing) warn("[i18n] Missing interpolation", key);
    return rendered;
  };
}

const render = createTranslator(resources);
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return render(locale, key, params);
}

export interface CatalogueParityIssue {
  key: string;
  kind:
    | "missing-key"
    | "extra-key"
    | "invalid-value"
    | "plural-mismatch"
    | "placeholder-mismatch";
  form?: "one" | "other";
}
function placeholders(value: string): string {
  return [
    ...new Set(
      [...value.matchAll(placeholderPattern)].map((match) => match[1]),
    ),
  ]
    .sort()
    .join("\n");
}

/** Reports every resource gap, plural-shape mismatch and per-form variable gap. */
export function validateCatalogueParity(
  base: Catalogue,
  target: Catalogue,
): CatalogueParityIssue[] {
  const issues: CatalogueParityIssue[] = [];
  for (const key of [
    ...new Set([...Object.keys(base), ...Object.keys(target)]),
  ].sort()) {
    if (!owns(base, key)) {
      issues.push({ key, kind: "extra-key" });
      continue;
    }
    if (!owns(target, key)) {
      issues.push({ key, kind: "missing-key" });
      continue;
    }
    const left = base[key];
    const right = target[key];
    if (!validValue(left) || !validValue(right)) {
      issues.push({ key, kind: "invalid-value" });
      continue;
    }
    if (typeof left === "string" && typeof right === "string") {
      if (placeholders(left) !== placeholders(right))
        issues.push({ key, kind: "placeholder-mismatch" });
    } else if (typeof left !== "string" && typeof right !== "string") {
      for (const form of ["one", "other"] as const) {
        if (placeholders(left[form]) !== placeholders(right[form]))
          issues.push({ key, kind: "placeholder-mismatch", form });
      }
    } else issues.push({ key, kind: "plural-mismatch" });
  }
  return issues;
}

export function validateCatalogues(
  catalogues: Catalogues = resources,
): CatalogueParityIssue[] {
  return validateCatalogueParity(
    catalogues["zh-CN"] ?? {},
    catalogues["en-US"] ?? {},
  );
}

export type SourceTime = string | number | Date | null | undefined;
/** Formatting is display-only: never rewrite an event's original timestamp. */
export function formatSourceTime(
  locale: Locale,
  value: SourceTime,
  dateTime = false,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "number" || (typeof value === "string" && value.trim())
        ? new Date(value)
        : null;
  if (!date || !Number.isFinite(date.getTime()) || date.getTime() === 0)
    return translate(locale, "common.unknownTime");
  const format: Intl.DateTimeFormatOptions = {
    ...(dateTime ? { year: "numeric", month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...options,
  };
  try {
    return new Intl.DateTimeFormat(locale, format).format(date);
  } catch {
    return translate(locale, "common.unknownTime");
  }
}
