// ES2023 Intl: "negative" shows a minus only for values below zero, so a
// rounded zero never displays as "-A$0". Supported by all current browsers
// and workerd; TypeScript's bundled lib has not added it yet.
declare namespace Intl {
  interface NumberFormatOptionsSignDisplayRegistry {
    negative: never;
  }
}
