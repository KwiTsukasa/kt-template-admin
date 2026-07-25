export type SupportedLanguagesType = 'en-US' | 'zh-CN';

export type ImportLocaleFn = () => Promise<{ default: Record<string, string> }>;

export type LoadMessageFn = (
  lang: SupportedLanguagesType,
) => Promise<Record<string, string> | undefined>;

export interface LocaleSetupOptions {
  defaultLocale?: SupportedLanguagesType;
  loadMessages?: LoadMessageFn;
  missingWarn?: boolean;
}
