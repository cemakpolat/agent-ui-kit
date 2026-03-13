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
  // ── CalendarRenderer ────────────────────────────────────────────────────────
  calPrevMonth: string;
  calNextMonth: string;
  calPrevWeek: string;
  calNextWeek: string;
  calPrevPeriod: string;
  calNextPeriod: string;
  calAgenda: string;
  calToday: string;
  calAllDay: string;
  calNoEvents: string;
  calMore: (n: number) => string;
  calInvalidData: string;
  // ── ChatRenderer ────────────────────────────────────────────────────────────
  chatSend: string;
  chatPlaceholder: string;
  chatTyping: string;
  chatThinking: string;
  chatError: string;
  chatRetry: string;
  chatNewMessages: string;
  chatInvalidData: string;
  chatCopyMessage: string;
  chatCopied: string;
  chatRegenerate: string;
  chatEdit: string;
  chatEdited: string;
  chatStopGenerating: string;
  chatFeedbackPositive: string;
  chatFeedbackNegative: string;
  chatWelcome: string;
  chatCitations: string;
  chatShowThinking: string;
  chatHideThinking: string;
  chatSearchMessages: string;
  chatDragDrop: string;
  chatCopyCode: string;
  chatCodeCopied: string;
  // ── KanbanRenderer ─────────────────────────────────────────────────────────
  kanbanNoCards: string;
  kanbanInvalidData: string;
  kanbanWipLimit: (n: number) => string;
  kanbanCards: (n: number) => string;
  // ── TimelineRenderer ───────────────────────────────────────────────────────
  timelineNoEvents: string;
  timelineShowing: (shown: number, total: number) => string;
  timelineInvalidData: string;
  // ── TreeRenderer ────────────────────────────────────────────────────────────
  treeExpandAll: string;
  treeCollapseAll: string;
  treeSearch: string;
  treeNoResults: string;
  treeDescendants: (n: number) => string;
  treeInvalidData: string;
  // ── WorkflowRenderer ───────────────────────────────────────────────────────
  workflowBack: string;
  workflowNext: string;
  workflowSkip: string;
  workflowConfirm: string;
  workflowCancel: string;
  workflowInvalidData: string;
  // ── Common / shared ────────────────────────────────────────────────────────
  explain: string;
  loading: string;
  error: string;
  retry: string;
  close: string;
  confirm: string;
  cancel: string;
  noData: string;
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
  endDateError: 'End date must be on or after the start date',
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
  // Calendar
  calPrevMonth: 'Previous month',
  calNextMonth: 'Next month',
  calPrevWeek: 'Previous week',
  calNextWeek: 'Next week',
  calPrevPeriod: 'Previous period',
  calNextPeriod: 'Next period',
  calAgenda: 'Agenda',
  calToday: 'Today',
  calAllDay: 'All day',
  calNoEvents: 'No events in this period.',
  calMore: (n) => `+${n} more`,
  calInvalidData: 'Invalid calendar data.',
  // Chat
  chatSend: 'Send',
  chatPlaceholder: 'Type a message…',
  chatTyping: 'is typing…',
  chatThinking: 'Thinking…',
  chatError: 'Message failed to send.',
  chatRetry: 'Retry',
  chatNewMessages: 'New messages',
  chatInvalidData: 'Invalid chat data.',
  chatCopyMessage: 'Copy message',
  chatCopied: 'Copied!',
  chatRegenerate: 'Regenerate',
  chatEdit: 'Edit',
  chatEdited: 'edited',
  chatStopGenerating: 'Stop generating',
  chatFeedbackPositive: 'Good response',
  chatFeedbackNegative: 'Bad response',
  chatWelcome: 'How can I help you today?',
  chatCitations: 'Sources',
  chatShowThinking: 'Show thinking',
  chatHideThinking: 'Hide thinking',
  chatSearchMessages: 'Search messages…',
  chatDragDrop: 'Drop files here to attach',
  chatCopyCode: 'Copy code',
  chatCodeCopied: 'Copied!',
  // Kanban
  kanbanNoCards: 'No cards',
  kanbanInvalidData: 'Invalid kanban data.',
  kanbanWipLimit: (n) => `WIP limit: ${n}`,
  kanbanCards: (n) => `${n} card${n !== 1 ? 's' : ''}`,
  // Timeline
  timelineNoEvents: 'No events to display.',
  timelineShowing: (shown, total) => `Showing ${shown} most recent of ${total} events`,
  timelineInvalidData: 'Invalid timeline data.',
  // Tree
  treeExpandAll: 'Expand all',
  treeCollapseAll: 'Collapse all',
  treeSearch: 'Search…',
  treeNoResults: 'No matching nodes.',
  treeDescendants: (n) => `${n} item${n !== 1 ? 's' : ''}`,
  treeInvalidData: 'Invalid tree data.',
  // Workflow
  workflowBack: '← Back',
  workflowNext: 'Next →',
  workflowSkip: 'Skip',
  workflowConfirm: 'Confirm',
  workflowCancel: 'Cancel',
  workflowInvalidData: 'Invalid workflow data.',
  // Common
  explain: 'Why?',
  loading: 'Loading…',
  error: 'Error',
  retry: 'Retry',
  close: 'Close',
  confirm: 'Confirm',
  cancel: 'Cancel',
  noData: 'No data available.',
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
  endDateError: 'La date de fin doit être postérieure à la date de début',
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
  calPrevMonth: 'Mois précédent',
  calNextMonth: 'Mois suivant',
  calPrevWeek: 'Semaine précédente',
  calNextWeek: 'Semaine suivante',
  calPrevPeriod: 'Période précédente',
  calNextPeriod: 'Période suivante',
  calAgenda: 'Agenda',
  calToday: 'Aujourd\'hui',
  calAllDay: 'Toute la journée',
  calNoEvents: 'Aucun événement pour cette période.',
  calMore: (n) => `+${n} de plus`,
  calInvalidData: 'Données de calendrier invalides.',
  chatSend: 'Envoyer',
  chatPlaceholder: 'Saisissez un message…',
  chatTyping: 'est en train d\'écrire…',
  chatThinking: 'Réflexion…',
  chatError: 'Échec de l\'envoi du message.',
  chatRetry: 'Réessayer',
  chatNewMessages: 'Nouveaux messages',
  chatInvalidData: 'Données de chat invalides.',
  chatCopyMessage: 'Copier le message',
  chatCopied: 'Copié !',
  chatRegenerate: 'Régénérer',
  chatEdit: 'Modifier',
  chatEdited: 'modifié',
  chatStopGenerating: 'Arrêter la génération',
  chatFeedbackPositive: 'Bonne réponse',
  chatFeedbackNegative: 'Mauvaise réponse',
  chatWelcome: 'Comment puis-je vous aider ?',
  chatCitations: 'Sources',
  chatShowThinking: 'Montrer la réflexion',
  chatHideThinking: 'Masquer la réflexion',
  chatSearchMessages: 'Chercher dans les messages…',
  chatDragDrop: 'Déposez les fichiers ici pour les joindre',
  chatCopyCode: 'Copier le code',
  chatCodeCopied: 'Copié !',
  kanbanNoCards: 'Aucune carte',
  kanbanInvalidData: 'Données kanban invalides.',
  kanbanWipLimit: (n) => `Limite TEF : ${n}`,
  kanbanCards: (n) => `${n} carte${n !== 1 ? 's' : ''}`,
  timelineNoEvents: 'Aucun événement à afficher.',
  timelineShowing: (shown, total) => `Affichage de ${shown} événements les plus récents sur ${total}`,
  timelineInvalidData: 'Données de chronologie invalides.',
  treeExpandAll: 'Tout développer',
  treeCollapseAll: 'Tout réduire',
  treeSearch: 'Rechercher…',
  treeNoResults: 'Aucun nœud correspondant.',
  treeDescendants: (n) => `${n} élément${n !== 1 ? 's' : ''}`,
  treeInvalidData: 'Données d\'arborescence invalides.',
  workflowBack: '← Retour',
  workflowNext: 'Suivant →',
  workflowSkip: 'Ignorer',
  workflowConfirm: 'Confirmer',
  workflowCancel: 'Annuler',
  workflowInvalidData: 'Données de flux invalides.',
  explain: 'Pourquoi ?',
  loading: 'Chargement…',
  error: 'Erreur',
  retry: 'Réessayer',
  close: 'Fermer',
  confirm: 'Confirmer',
  cancel: 'Annuler',
  noData: 'Aucune donnée disponible.',
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
  endDateError: 'Das Enddatum muss nach dem Startdatum liegen',
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
  calPrevMonth: 'Vorheriger Monat',
  calNextMonth: 'Nächster Monat',
  calPrevWeek: 'Vorherige Woche',
  calNextWeek: 'Nächste Woche',
  calPrevPeriod: 'Vorherige Periode',
  calNextPeriod: 'Nächste Periode',
  calAgenda: 'Terminübersicht',
  calToday: 'Heute',
  calAllDay: 'Ganztägig',
  calNoEvents: 'Keine Ereignisse in diesem Zeitraum.',
  calMore: (n) => `+${n} weitere`,
  calInvalidData: 'Ungültige Kalenderdaten.',
  chatSend: 'Senden',
  chatPlaceholder: 'Nachricht eingeben…',
  chatTyping: 'tippt…',
  chatThinking: 'Denkt nach…',
  chatError: 'Nachricht konnte nicht gesendet werden.',
  chatRetry: 'Wiederholen',
  chatNewMessages: 'Neue Nachrichten',
  chatInvalidData: 'Ungültige Chat-Daten.',
  chatCopyMessage: 'Nachricht kopieren',
  chatCopied: 'Kopiert!',
  chatRegenerate: 'Neu generieren',
  chatEdit: 'Bearbeiten',
  chatEdited: 'bearbeitet',
  chatStopGenerating: 'Generierung stoppen',
  chatFeedbackPositive: 'Gute Antwort',
  chatFeedbackNegative: 'Schlechte Antwort',
  chatWelcome: 'Wie kann ich Ihnen helfen?',
  chatCitations: 'Quellen',
  chatShowThinking: 'Denkprozess zeigen',
  chatHideThinking: 'Denkprozess verbergen',
  chatSearchMessages: 'Nachrichten durchsuchen…',
  chatDragDrop: 'Dateien hier ablegen zum Anhängen',
  chatCopyCode: 'Code kopieren',
  chatCodeCopied: 'Kopiert!',
  kanbanNoCards: 'Keine Karten',
  kanbanInvalidData: 'Ungültige Kanban-Daten.',
  kanbanWipLimit: (n) => `WIP-Limit: ${n}`,
  kanbanCards: (n) => `${n} Karte${n !== 1 ? 'n' : ''}`,
  timelineNoEvents: 'Keine Ereignisse anzuzeigen.',
  timelineShowing: (shown, total) => `Zeige ${shown} neueste von ${total} Ereignissen`,
  timelineInvalidData: 'Ungültige Timeline-Daten.',
  treeExpandAll: 'Alle aufklappen',
  treeCollapseAll: 'Alle zuklappen',
  treeSearch: 'Suchen…',
  treeNoResults: 'Keine passenden Knoten.',
  treeDescendants: (n) => `${n} Element${n !== 1 ? 'e' : ''}`,
  treeInvalidData: 'Ungültige Baumdaten.',
  workflowBack: '← Zurück',
  workflowNext: 'Weiter →',
  workflowSkip: 'Überspringen',
  workflowConfirm: 'Bestätigen',
  workflowCancel: 'Abbrechen',
  workflowInvalidData: 'Ungültige Workflow-Daten.',
  explain: 'Warum?',
  loading: 'Wird geladen…',
  error: 'Fehler',
  retry: 'Wiederholen',
  close: 'Schließen',
  confirm: 'Bestätigen',
  cancel: 'Abbrechen',
  noData: 'Keine Daten verfügbar.',
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
  endDateError: 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية أو مساوياً له',
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
  calPrevMonth: 'الشهر السابق',
  calNextMonth: 'الشهر التالي',
  calPrevWeek: 'الأسبوع السابق',
  calNextWeek: 'الأسبوع التالي',
  calPrevPeriod: 'الفترة السابقة',
  calNextPeriod: 'الفترة التالية',
  calAgenda: 'جدول أعمال',
  calToday: 'اليوم',
  calAllDay: 'طوال اليوم',
  calNoEvents: 'لا توجد أحداث في هذه الفترة.',
  calMore: (n) => `+${n} المزيد`,
  calInvalidData: 'بيانات التقويم غير صالحة.',
  chatSend: 'إرسال',
  chatPlaceholder: 'اكتب رسالة…',
  chatTyping: 'يكتب…',
  chatThinking: 'يفكر…',
  chatError: 'فشل إرسال الرسالة.',
  chatRetry: 'إعادة المحاولة',
  chatNewMessages: 'رسائل جديدة',
  chatInvalidData: 'بيانات الدردشة غير صالحة.',
  chatCopyMessage: 'نسخ الرسالة',
  chatCopied: 'تم النسخ!',
  chatRegenerate: 'إعادة التوليد',
  chatEdit: 'تعديل',
  chatEdited: 'تم التعديل',
  chatStopGenerating: 'إيقاف التوليد',
  chatFeedbackPositive: 'استجابة جيدة',
  chatFeedbackNegative: 'استجابة سيئة',
  chatWelcome: 'كيف يمكنني مساعدتك اليوم؟',
  chatCitations: 'المصادر',
  chatShowThinking: 'عرض التفكير',
  chatHideThinking: 'إخفاء التفكير',
  chatSearchMessages: 'البحث في الرسائل…',
  chatDragDrop: 'أفلت الملفات هنا لإرفاقها',
  chatCopyCode: 'نسخ الكود',
  chatCodeCopied: 'تم النسخ!',
  kanbanNoCards: 'لا توجد بطاقات',
  kanbanInvalidData: 'بيانات كانبان غير صالحة.',
  kanbanWipLimit: (n) => `حد العمل الجاري: ${n}`,
  kanbanCards: (n) => `${n} بطاقة`,
  timelineNoEvents: 'لا توجد أحداث للعرض.',
  timelineShowing: (shown, total) => `عرض ${shown} أحدث من ${total} حدث`,
  timelineInvalidData: 'بيانات مخطط زمني غير صالحة.',
  treeExpandAll: 'توسيع الكل',
  treeCollapseAll: 'طي الكل',
  treeSearch: 'بحث…',
  treeNoResults: 'لا توجد عقد مطابقة.',
  treeDescendants: (n) => `${n} عنصر`,
  treeInvalidData: 'بيانات الشجرة غير صالحة.',
  workflowBack: 'رجوع →',
  workflowNext: '← التالي',
  workflowSkip: 'تخطي',
  workflowConfirm: 'تأكيد',
  workflowCancel: 'إلغاء',
  workflowInvalidData: 'بيانات سير العمل غير صالحة.',
  explain: 'لماذا؟',
  loading: 'جاري التحميل…',
  error: 'خطأ',
  retry: 'إعادة المحاولة',
  close: 'إغلاق',
  confirm: 'تأكيد',
  cancel: 'إلغاء',
  noData: 'لا تتوفر بيانات.',
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
  endDateError: 'תאריך הסיום חייב להיות שווה לתאריך ההתחלה או מאוחר ממנו',
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
  calPrevMonth: 'חודש קודם',
  calNextMonth: 'חודש הבא',
  calPrevWeek: 'שבוע קודם',
  calNextWeek: 'שבוע הבא',
  calPrevPeriod: 'תקופה קודמת',
  calNextPeriod: 'תקופה הבאה',
  calAgenda: 'יומן',
  calToday: 'היום',
  calAllDay: 'כל היום',
  calNoEvents: 'אין אירועים בתקופה זו.',
  calMore: (n) => `+${n} נוספים`,
  calInvalidData: 'נתוני לוח שנה לא תקינים.',
  chatSend: 'שלח',
  chatPlaceholder: 'הקלד הודעה…',
  chatTyping: 'מקליד…',
  chatThinking: 'חושב…',
  chatError: 'שליחת ההודעה נכשלה.',
  chatRetry: 'נסה שוב',
  chatNewMessages: 'הודעות חדשות',
  chatInvalidData: 'נתוני צ\'אט לא תקינים.',
  chatCopyMessage: 'העתק הודעה',
  chatCopied: 'הועתק!',
  chatRegenerate: 'צור מחדש',
  chatEdit: 'ערוך',
  chatEdited: 'נערך',
  chatStopGenerating: 'הפסק יצירה',
  chatFeedbackPositive: 'תגובה טובה',
  chatFeedbackNegative: 'תגובה גרועה',
  chatWelcome: 'איך אוכל לעזור לך?',
  chatCitations: 'מקורות',
  chatShowThinking: 'הצג חשיבה',
  chatHideThinking: 'הסתר חשיבה',
  chatSearchMessages: 'חפש בהודעות…',
  chatDragDrop: 'גרור קבצים לכאן לצירוף',
  chatCopyCode: 'העתק קוד',
  chatCodeCopied: 'הועתק!',
  kanbanNoCards: 'אין כרטיסים',
  kanbanInvalidData: 'נתוני קנבאן לא תקינים.',
  kanbanWipLimit: (n) => `מגבלת עבודה בתהליך: ${n}`,
  kanbanCards: (n) => `${n} כרטיס${n !== 1 ? 'ים' : ''}`,
  timelineNoEvents: 'אין אירועים להצגה.',
  timelineShowing: (shown, total) => `מציג ${shown} אחרונים מתוך ${total} אירועים`,
  timelineInvalidData: 'נתוני ציר זמן לא תקינים.',
  treeExpandAll: 'הרחב הכל',
  treeCollapseAll: 'כווץ הכל',
  treeSearch: 'חפש…',
  treeNoResults: 'אין צמתים תואמים.',
  treeDescendants: (n) => `${n} פריט${n !== 1 ? 'ים' : ''}`,
  treeInvalidData: 'נתוני עץ לא תקינים.',
  workflowBack: 'חזור →',
  workflowNext: '← הבא',
  workflowSkip: 'דלג',
  workflowConfirm: 'אשר',
  workflowCancel: 'בטל',
  workflowInvalidData: 'נתוני תהליך עבודה לא תקינים.',
  explain: 'למה?',
  loading: 'טוען…',
  error: 'שגיאה',
  retry: 'נסה שוב',
  close: 'סגור',
  confirm: 'אשר',
  cancel: 'בטל',
  noData: 'אין נתונים זמינים.',
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
