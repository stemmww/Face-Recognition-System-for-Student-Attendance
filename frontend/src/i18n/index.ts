import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import kk from "./locales/kk";
import ru from "./locales/ru";

const savedLang = localStorage.getItem("language") || "en";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, kk: { translation: kk }, ru: { translation: ru } },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
