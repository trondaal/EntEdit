import "react-i18next";
import common from "../locales/en/common.json";
import entityEditor from "../locales/en/entityEditor.json";

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      entityEditor: typeof entityEditor;
    };
  }
}
