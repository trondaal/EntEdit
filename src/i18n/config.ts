import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import translation files
import commonEN from "../locales/en/common.json";
import commonNO from "../locales/no/common.json";
import entityEditorEN from "../locales/en/entityEditor.json";
import entityEditorNO from "../locales/no/entityEditor.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEN,
        entityEditor: entityEditorEN,
      },
      no: {
        common: commonNO,
        entityEditor: entityEditorNO,
      },
    },
    lng: "en", // default language
    fallbackLng: "en",
    defaultNS: "common",
    interpolation: {
      escapeValue: false, // React already escapes
    },
    // Enable debug mode in development
    debug: import.meta.env.DEV,
  });

export default i18n;
