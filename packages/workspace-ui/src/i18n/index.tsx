import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type PropsWithChildren, type SyntheticEvent,
} from "react";
import type { TranslationKey } from "./catalogues";
import {
  formatSourceTime, isLocale, LOCALE_STORAGE_KEY, translate,
  type Locale, type SourceTime, type TranslationParams,
} from "./core";
import "./locale.css";

export * from "./core";
export type { TranslationKey } from "./catalogues";

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatTime: (value: SourceTime, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: SourceTime, options?: Intl.DateTimeFormatOptions) => string;
}

function valueFor(locale: Locale, setLocale: I18nValue["setLocale"]): I18nValue {
  return {
    locale, setLocale,
    t: (key, params) => translate(locale, key, params),
    formatTime: (value, options) => formatSourceTime(locale, value, false, options),
    formatDateTime: (value, options) => formatSourceTime(locale, value, true, options),
  };
}

// Older read-only hosts remain Chinese until they add the shared provider.
// There is no second locale state or per-component store outside that provider.
const defaultValue = valueFor("zh-CN", () => {
  console.warn("[i18n] Locale switching requires I18nProvider");
});
const I18nContext = createContext<I18nValue>(defaultValue);

function initialLocale(): Locale {
  try {
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : "zh-CN";
  } catch { return "zh-CN"; }
}

/** Locale is presentation-only. Keep this provider mounted around the app;
 * changing its value neither keys nor recreates its child game/work controllers.
 */
export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    if (isLocale(next)) updateLocale(next);
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, locale); }
    catch { /* Storage-disabled browsing still supports the current session. */ }
  }, [locale]);
  const value = useMemo(() => valueFor(locale, setLocale), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue { return useContext(I18nContext); }

const stopGameInput = (event: SyntheticEvent) => event.stopPropagation();
export function LocaleSwitcher({ className,onPointerLocaleChange }: { className?: string;onPointerLocaleChange?:()=>void }) {
  const { locale, setLocale } = useI18n();
  return <div className={["dw-locale-switcher", className].filter(Boolean).join(" ")}
    role="group" aria-label="界面语言 / Interface language"
    onKeyDown={event=>{if(event.key!=="Escape")stopGameInput(event);}}
    onPointerDown={stopGameInput} onPointerUp={stopGameInput}
    onPointerMove={stopGameInput} onClick={stopGameInput} onWheel={stopGameInput}>
    <button type="button" lang="zh-CN" aria-pressed={locale === "zh-CN"}
      onClick={event => {setLocale("zh-CN");if(event.detail>0)onPointerLocaleChange?.();}}>中文</button>
    <button type="button" lang="en-US" aria-pressed={locale === "en-US"}
      onClick={event => {setLocale("en-US");if(event.detail>0)onPointerLocaleChange?.();}}>English</button>
  </div>;
}
