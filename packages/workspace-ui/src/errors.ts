import { translate, type TranslationParams } from "./i18n/core";
import type { TranslationKey } from "./i18n/catalogues";

/** A presentation descriptor, never a command or authorization field. */
export class WorkspaceFault extends Error {
  constructor(
    readonly key: Extract<TranslationKey, `errors.${string}`>,
    readonly params?: TranslationParams,
  ) {
    super(translate("zh-CN", key, params));
    this.name = "WorkspaceFault";
  }
}
