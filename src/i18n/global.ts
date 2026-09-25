import type { AppLocale } from "./locales";
import type messages from "../../messages/ko.json";

// ko.json을 기준으로 메시지 키를 타입 검사한다. 없는 키를 쓰면 typecheck에서 걸린다.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}
