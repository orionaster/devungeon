import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createTranslator,
  formatSourceTime,
  LOCALE_STORAGE_KEY,
  translate,
  validateCatalogueParity,
  validateCatalogues,
  type Catalogue,
  type TranslationParams,
} from "../src/i18n/core";
import { I18nProvider, LocaleSwitcher, useI18n } from "../src/i18n";
import type { TranslationKey } from "../src/i18n/catalogues";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("typed local translation boundary", () => {
  it("keeps application keys finite and validates all shipped resources", () => {
    expectTypeOf<
      Parameters<typeof translate>[1]
    >().toEqualTypeOf<TranslationKey>();
    expectTypeOf<TranslationKey>().not.toEqualTypeOf<string>();
    expect(validateCatalogues()).toEqual([]);
    expect(translate("zh-CN", "common.language")).not.toMatch(/^\[/);
    expect(translate("en-US", "common.language")).not.toMatch(/^\[/);
  });

  it("uses Intl plural selection rather than assuming every language has English plurals", () => {
    const t = createTranslator({
      "zh-CN": { count: { one: "单数 {count}", other: "计数 {count}" } },
      "en-US": {
        count: { one: "{count} approval", other: "{count} approvals" },
      },
    });
    expect(t("en-US", "count", { count: 1 })).toBe("1 approval");
    expect(t("en-US", "count", { count: "2" })).toBe("2 approvals");
    expect(t("en-US", "count", { count: 0 })).toBe("0 approvals");
    expect(t("zh-CN", "count", { count: 1 })).toBe("计数 1");
    const fallback = createTranslator(
      { "zh-CN": { count: { one: "单数", other: "计数 {count}" } } },
      vi.fn(),
    );
    expect(fallback("en-US", "count", { count: 1 })).toBe("计数 1");
    expect(translate("en-US", "work.approvalCount", { count: 2 })).toContain(
      "2",
    );
  });

  it("falls back to Chinese then a visible key, without logging source parameters", () => {
    const warn = vi.fn();
    const t = createTranslator(
      { "zh-CN": { fallback: "中文 {name}" }, "en-US": {} },
      warn,
    );
    expect(t("en-US", "fallback", { name: "private-source-value" })).toBe(
      "中文 private-source-value",
    );
    expect(t("en-US", "missing", { token: "private-source-value" })).toBe(
      "[missing]",
    );
    expect(warn.mock.calls).toEqual([
      ["[i18n] Missing translation", "fallback"],
      ["[i18n] Missing translation", "missing"],
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      "private-source-value",
    );
  });

  it("keeps missing variables visible and does not interpolate inherited properties", () => {
    const warn = vi.fn();
    const t = createTranslator(
      {
        "zh-CN": {
          greeting: "你好 {name}，{count}",
          count: { one: "{count} item", other: "{count} items" },
        },
      },
      warn,
    );
    const params = Object.create({
      name: "not-an-own-param",
    }) as TranslationParams;
    params.count = 0;
    expect(t("zh-CN", "greeting", params)).toBe("你好 {name}，0");
    expect(t("zh-CN", "count")).toBe("{count} items");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("not-an-own-param");
    expect(warn.mock.calls.every((args) => args.length === 2)).toBe(true);
  });

  it("preserves source text literally, without recursively translating or mutating it", () => {
    const t = createTranslator({ "zh-CN": { source: "原文：{value}" } });
    const params = Object.freeze({
      value: "$& $1 {other} <script>English source</script>",
    });
    expect(t("zh-CN", "source", params)).toBe(`原文：${params.value}`);
    expect(params.value).toBe("$& $1 {other} <script>English source</script>");
  });

  it("reports missing/extra keys, plural shape and placeholder gaps in every form", () => {
    const base: Catalogue = {
      missing: "遗漏",
      scalar: "你好 {name}",
      shape: { one: "{count} 项", other: "{count} 项" },
      plural: { one: "{count} {name}", other: "{count} {name}" },
    };
    const target: Catalogue = {
      extra: "Extra",
      scalar: "Hello {different}",
      shape: "{count} items",
      plural: { one: "{count} {name}", other: "{count}" },
    };
    expect(validateCatalogueParity(base, target)).toEqual([
      { key: "extra", kind: "extra-key" },
      { key: "missing", kind: "missing-key" },
      { key: "plural", kind: "placeholder-mismatch", form: "other" },
      { key: "scalar", kind: "placeholder-mismatch" },
      { key: "shape", kind: "plural-mismatch" },
    ]);
    expect(validateCatalogueParity({ blank: "正文" }, { blank: " " })).toEqual([
      { key: "blank", kind: "invalid-value" },
    ]);
    expect(
      validateCatalogueParity(
        { repeated: "{name} {name} {count}" },
        { repeated: "{count} {name}" },
      ),
    ).toEqual([]);
  });
});

describe("source time formatting", () => {
  it.each([
    undefined,
    null,
    "",
    "not-a-time",
    0,
    NaN,
    new Date(NaN),
    new Date(0),
    "1970-01-01T00:00:00.000Z",
  ])(
    "uses a translated unknown label for invalid/unobserved time %s",
    (value) => {
      expect(formatSourceTime("zh-CN", value)).toBe(
        translate("zh-CN", "common.unknownTime"),
      );
      expect(formatSourceTime("en-US", value, true)).toBe(
        translate("en-US", "common.unknownTime"),
      );
    },
  );

  it("formats in the selected locale while preserving the original timestamp", () => {
    const raw = "2026-11-14T08:09:10.000Z";
    const date = new Date(raw);
    const before = date.getTime();
    for (const locale of ["zh-CN", "en-US"] as const) {
      expect(formatSourceTime(locale, date, true, { timeZone: "UTC" })).toBe(
        new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }).format(date),
      );
      expect(
        formatSourceTime(locale, raw, false, { timeZone: "UTC" }),
      ).toContain("08:09:10");
    }
    expect(raw).toBe("2026-11-14T08:09:10.000Z");
    expect(date.getTime()).toBe(before);
  });
});

describe("provider defaults and accessible switcher markup", () => {
  function Probe() {
    const { locale } = useI18n();
    return createElement(
      "span",
      { "data-locale": locale },
      createElement(LocaleSwitcher),
    );
  }
  function markup() {
    return renderToStaticMarkup(
      createElement(I18nProvider, null, createElement(Probe)),
    );
  }

  it("defaults to Chinese irrespective of navigator, with explicit button semantics", () => {
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US"] });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(() => null) } });
    const html = markup();
    expect(html).toContain('data-locale="zh-CN"');
    expect(html).toContain('aria-label="界面语言 / Interface language"');
    expect(html).toContain('type="button" lang="zh-CN" aria-pressed="true"');
    expect(html).toContain('type="button" lang="en-US" aria-pressed="false"');
    expect(html).toContain(">中文</button>");
    expect(html).toContain(">English</button>");
  });

  it("restores only the explicit versioned preference and tolerates invalid/disabled storage", () => {
    const getItem = vi.fn(() => "en-US");
    vi.stubGlobal("window", { localStorage: { getItem } });
    expect(markup()).toContain('data-locale="en-US"');
    expect(getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY);
    getItem.mockReturnValue("en-GB");
    expect(markup()).toContain('data-locale="zh-CN"');
    getItem.mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(markup()).toContain('data-locale="zh-CN"');
  });

  it("keeps legacy unwrapped read-only hosts Chinese", () => {
    expect(renderToStaticMarkup(createElement(Probe))).toContain(
      'data-locale="zh-CN"',
    );
  });
});
