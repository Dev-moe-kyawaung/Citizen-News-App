import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as RNLocalize from "react-native-localize";
import AsyncStorage from "@react-native-async-storage/async-storage";

import enCommon from "./locales/en/common.json";
import enFeed from "./locales/en/feed.json";
import enEditor from "./locales/en/editor.json";
import enAdmin from "./locales/en/admin.json";
import myCommon from "./locales/my/common.json";
import myFeed from "./locales/my/feed.json";
import myEditor from "./locales/my/editor.json";
import myAdmin from "./locales/my/admin.json";

const LANGUAGE_STORAGE_KEY = "@citizen_news/language";

const resources = {
  en: { common: enCommon, feed: enFeed, editor: enEditor, admin: enAdmin },
  my: { common: myCommon, feed: myFeed, editor: myEditor, admin: myAdmin },
};

export async function initI18n() {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const deviceLocale = RNLocalize.getLocales()[0]?.languageCode;
  const initialLang = stored ?? (deviceLocale === "my" ? "my" : "en");

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLang,
    fallbackLng: "en",
    ns: ["common", "feed", "editor", "admin"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  return i18n;
}

export async function setAppLanguage(lang: "en" | "my") {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
