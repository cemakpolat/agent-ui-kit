// ─────────────────────────────────────────────────────────────────────────────
// i18n — Locale definitions and UI message translations.
//
// Usage:
//   import { getMessages, isRtlLocale } from '../i18n';
//   const m = getMessages('fr');
//   const dir = isRtlLocale('ar') ? 'rtl' : 'ltr';
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';

export type UILocale = 'en' | 'fr' | 'de' | 'ar' | 'he';

export interface UIMessages {
  // ── FormRenderer ────────────────────────────────────────────────────────────
  fieldRequired: (label: string) => string;
  tooManyAttempts: (waitSec: number) => string;
  draftFound: string;
  draftRestore: string;
  draftDiscard: string;
  wizardBack: string;
  wizardNext: string;
  submitting: string;
  stepOf: (current: number, total: number) => string;
  sectionExpand: string;
  sectionCollapse: string;
  richTextPlaceholder: string;
  selectPlaceholder: string;
  endDateError: string;
  minLength: (n: number) => string;
  // ── DocumentRenderer ────────────────────────────────────────────────────────
  copyCode: string;
  codeCopied: string;
  filterRows: string;
  filterTableAriaLabel: string;
  clickToExpand: string;
  searchSections: string;
  searchDocumentAriaLabel: string;
  exportMarkdown: string;
  exportMarkdownAriaLabel: string;
  printPdf: string;
  printPdfAriaLabel: string;
  expandSection: (title: string) => string;
  collapseSection: (title: string) => string;
  calloutInfo: string;
  calloutWarning: string;
  calloutInsight: string;
  calloutCritical: string;
}

// ── English (default) ────────────────────────────────────────────────────────

const en: UIMessages = {
  fieldRequired: (label) => `${label} is required`,
  tooManyAttempts: (waitSec) => `Too many attempts. Please wait ${waitSec}s before retrying.`,
  draftFound: 'A saved draft was found. Would you like to restore it?',
  draftRestore: 'Restore',
  draftDiscard: 'Discard',
  wizardBack: '← Back',
  wizardNext: 'Next →',
  submitting: 'Submitting…',
  stepOf: (c, t) => `Step ${c} of ${t}`,
  sectionExpand: 'Expand ▼',
  sectionCollapse: 'Collapse ▲',
  richTextPlaceholder: 'Write here… supports **bold**, _italic_, [links](url)',
  selectPlaceholder: 'Select an option…',
  endDateError: '⚠ End date must be on or after the start date',
  minLength: (n) => `min ${n}`,
  copyCode: 'Copy code',
  codeCopied: 'Code copied',
  filterRows: 'Filter rows…',
  filterTableAriaLabel: 'Filter table rows',
  clickToExpand: 'Click to expand',
  searchSections: 'Search sections…',
  searchDocumentAriaLabel: 'Search document',
  exportMarkdown: '↓ Export .md',
  exportMarkdownAriaLabel: 'Export document as Markdown',
  printPdf: '⎙ Print / PDF',
  printPdfAriaLabel: 'Print or save as PDF',
  expandSection: (t) => `Expand ${t}`,
  collapseSection: (t) => `Collapse ${t}`,
  calloutInfo: 'Note',
  calloutWarning: 'Warning',
  calloutInsight: 'Insight',
  calloutCritical: 'Critical',
};

// ── French ───────────────────────────────────────────────────────────────────

const fr: UIMessages = {
  fieldRequired: (label) => `${label} est requis`,
  tooManyAttempts: (waitSec) =>
    `Trop de tentatives. Veuillez patienter ${waitSec}s avant de réessayer.`,
  draftFound: 'Un brouillon sauvegardé a été trouvé. Voulez-vous le restaurer ?',
  draftRestore: 'Restaurer',
  draftDiscard: 'Ignorer',
  wizardBack: '← Retour',
  wizardNext: 'Suivant →',
  submitting: 'Envoi en cours…',
  stepOf: (c, t) => `Étape ${c} sur ${t}`,
  sectionExpand: 'Afficher ▼',
  sectionCollapse: 'Réduire ▲',
  richTextPlaceholder: 'Écrivez ici… supporte **gras**, _italique_, [liens](url)',
  selectPlaceholder: 'Sélectionnez une option…',
  endDateError: '⚠ La date de fin doit être postérieure à la date de début',
  minLength: (n) => `min ${n}`,
  copyCode: 'Copier le code',
  codeCopied: 'Code copié',
  filterRows: 'Filtrer les lignes…',
  filterTableAriaLabel: 'Filtrer les lignes du tableau',
  clickToExpand: 'Cliquer pour agrandir',
  searchSections: 'Rechercher des sections…',
  searchDocumentAriaLabel: 'Rechercher dans le document',
  exportMarkdown: '↓ Exporter .md',
  exportMarkdownAriaLabel: 'Exporter le document en Markdown',
  printPdf: '⎙ Imprimer / PDF',
  printPdfAriaLabel: 'Imprimer ou enregistrer en PDF',
  expandSection: (t) => `Développer ${t}`,
  collapseSection: (t) => `Réduire ${t}`,
  calloutInfo: 'Note',
  calloutWarning: 'Avertissement',
  calloutInsight: 'Aperçu',
  calloutCritical: 'Critique',
};

// ── German ───────────────────────────────────────────────────────────────────

const de: UIMessages = {
  fieldRequired: (label) => `${label} ist erforderlich`,
  tooManyAttempts: (waitSec) =>
    `Zu viele Versuche. Bitte warten Sie ${waitSec}s, bevor Sie es erneut versuchen.`,
  draftFound: 'Ein gespeicherter Entwurf wurde gefunden. Möchten Sie ihn wiederherstellen?',
  draftRestore: 'Wiederherstellen',
  draftDiscard: 'Verwerfen',
  wizardBack: '← Zurück',
  wizardNext: 'Weiter →',
  submitting: 'Wird gesendet…',
  stepOf: (c, t) => `Schritt ${c} von ${t}`,
  sectionExpand: 'Erweitern ▼',
  sectionCollapse: 'Einklappen ▲',
  richTextPlaceholder: 'Hier schreiben… unterstützt **fett**, _kursiv_, [Links](url)',
  selectPlaceholder: 'Option auswählen…',
  endDateError: '⚠ Das Enddatum muss nach dem Startdatum liegen',
  minLength: (n) => `min ${n}`,
  copyCode: 'Code kopieren',
  codeCopied: 'Code kopiert',
  filterRows: 'Zeilen filtern…',
  filterTableAriaLabel: 'Tabellenzeilen filtern',
  clickToExpand: 'Zum Vergrößern klicken',
  searchSections: 'Abschnitte suchen…',
  searchDocumentAriaLabel: 'Dokument durchsuchen',
  exportMarkdown: '↓ Als .md exportieren',
  exportMarkdownAriaLabel: 'Dokument als Markdown exportieren',
  printPdf: '⎙ Drucken / PDF',
  printPdfAriaLabel: 'Drucken oder als PDF speichern',
  expandSection: (t) => `${t} erweitern`,
  collapseSection: (t) => `${t} einklappen`,
  calloutInfo: 'Hinweis',
  calloutWarning: 'Warnung',
  calloutInsight: 'Einblick',
  calloutCritical: 'Kritisch',
};

// ── Arabic (RTL) ─────────────────────────────────────────────────────────────

const ar: UIMessages = {
  fieldRequired: (label) => `${label} مطلوب`,
  tooManyAttempts: (waitSec) =>
    `محاولات كثيرة جداً. يرجى الانتظار ${waitSec} ثانية قبل المحاولة مرة أخرى.`,
  draftFound: 'تم العثور على مسودة محفوظة. هل تريد استعادتها؟',
  draftRestore: 'استعادة',
  draftDiscard: 'تجاهل',
  wizardBack: 'رجوع →',
  wizardNext: '← التالي',
  submitting: 'جاري الإرسال…',
  stepOf: (c, t) => `الخطوة ${c} من ${t}`,
  sectionExpand: 'توسيع ▼',
  sectionCollapse: 'طي ▲',
  richTextPlaceholder: 'اكتب هنا… يدعم **عريض**، _مائل_، [روابط](url)',
  selectPlaceholder: 'اختر خياراً…',
  endDateError: '⚠ يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية أو مساوياً له',
  minLength: (n) => `حد أدنى ${n}`,
  copyCode: 'نسخ الكود',
  codeCopied: 'تم نسخ الكود',
  filterRows: 'تصفية الصفوف…',
  filterTableAriaLabel: 'تصفية صفوف الجدول',
  clickToExpand: 'انقر للتوسيع',
  searchSections: 'البحث في الأقسام…',
  searchDocumentAriaLabel: 'البحث في المستند',
  exportMarkdown: '↓ تصدير .md',
  exportMarkdownAriaLabel: 'تصدير المستند بتنسيق Markdown',
  printPdf: '⎙ طباعة / PDF',
  printPdfAriaLabel: 'طباعة أو حفظ كـ PDF',
  expandSection: (t) => `توسيع ${t}`,
  collapseSection: (t) => `طي ${t}`,
  calloutInfo: 'ملاحظة',
  calloutWarning: 'تحذير',
  calloutInsight: 'رؤية',
  calloutCritical: 'حرج',
};

// ── Hebrew (RTL) ─────────────────────────────────────────────────────────────

const he: UIMessages = {
  fieldRequired: (label) => `${label} נדרש`,
  tooManyAttempts: (waitSec) =>
    `יותר מדי ניסיונות. אנא המתן ${waitSec} שניות לפני הניסיון הבא.`,
  draftFound: 'נמצאה טיוטה שמורה. האם ברצונך לשחזר אותה?',
  draftRestore: 'שחזר',
  draftDiscard: 'בטל',
  wizardBack: 'חזור →',
  wizardNext: '← הבא',
  submitting: 'שולח…',
  stepOf: (c, t) => `שלב ${c} מתוך ${t}`,
  sectionExpand: 'הרחב ▼',
  sectionCollapse: 'כווץ ▲',
  richTextPlaceholder: 'כתוב כאן… תומך **מודגש**, _נטוי_, [קישורים](url)',
  selectPlaceholder: 'בחר אפשרות…',
  endDateError: '⚠ תאריך הסיום חייב להיות שווה לתאריך ההתחלה או מאוחר ממנו',
  minLength: (n) => `מינימום ${n}`,
  copyCode: 'העתק קוד',
  codeCopied: 'קוד הועתק',
  filterRows: 'סנן שורות…',
  filterTableAriaLabel: 'סנן שורות בטבלה',
  clickToExpand: 'לחץ להרחבה',
  searchSections: 'חפש סעיפים…',
  searchDocumentAriaLabel: 'חפש במסמך',
  exportMarkdown: '↓ ייצא .md',
  exportMarkdownAriaLabel: 'ייצא מסמך כ-Markdown',
  printPdf: '⎙ הדפס / PDF',
  printPdfAriaLabel: 'הדפס או שמור כ-PDF',
  expandSection: (t) => `הרחב ${t}`,
  collapseSection: (t) => `כווץ ${t}`,
  calloutInfo: 'הערה',
  calloutWarning: 'אזהרה',
  calloutInsight: 'תובנה',
  calloutCritical: 'קריטי',
};

// ── Registry & helpers ───────────────────────────────────────────────────────

export const LOCALES: Record<UILocale, UIMessages> = { en, fr, de, ar, he };

/** Locales that read right-to-left. */
export const RTL_LOCALES = new Set<UILocale>(['ar', 'he']);

export function isRtlLocale(locale: UILocale): boolean {
  return RTL_LOCALES.has(locale);
}

export function getMessages(locale: UILocale = 'en'): UIMessages {
  return LOCALES[locale] ?? LOCALES.en;
}

// ── React context ─────────────────────────────────────────────────────────────

export const LocaleContext = React.createContext<UILocale>('en');

/** Hook: returns translated messages for the nearest LocaleContext locale. */
export function useMessages(): UIMessages {
  const locale = React.useContext(LocaleContext);
  return getMessages(locale);
}
