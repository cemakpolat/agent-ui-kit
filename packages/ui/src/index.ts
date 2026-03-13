// Core UI components
export { IntentRenderer } from './components/IntentRenderer';
export { BlastRadiusBadge } from './components/BlastRadiusBadge';
export { ExplainPanel } from './components/ExplainPanel';
export { AmbiguityControls } from './components/AmbiguityControls';
export { IntentErrorBoundary } from './components/IntentErrorBoundary';
export { HypotheticalOverlay } from './components/HypotheticalOverlay';
export { HypotheticalCompare } from './components/HypotheticalCompare';
export { DensitySelector } from './components/primitives/DensitySelector';

// ── Governance & Perception Components (v0.3+) ────────────────────────────────
export { AuthorityModeSwitch } from './components/AuthorityModeSwitch';
export type { AuthorityModeSwitchProps } from './components/AuthorityModeSwitch';

// ── Trust Surface — mandatory perception legitimacy indicator ─────────────────
export { TrustSurface } from './components/TrustSurface';
export type { TrustSurfaceProps, ApprovalState } from './components/TrustSurface';

export { UncertaintyIndicators } from './components/UncertaintyIndicators';
export type { UncertaintyIndicatorsProps } from './components/UncertaintyIndicators';

export { TemporalLensOverlay } from './components/TemporalLensOverlay';
export type { TemporalLensOverlayProps } from './components/TemporalLensOverlay';

export { GovernedActionPanel } from './components/GovernedActionPanel';
export type { GovernedActionPanelProps } from './components/GovernedActionPanel';

export { DecisionRecordViewer } from './components/DecisionRecordViewer';
export type { DecisionRecordViewerProps } from './components/DecisionRecordViewer';

// ── Phase 7: Performance & Scaling ───────────────────────────────────────────

// 7.1 — Virtualized / paginated / grouped decision timeline
export { VirtualDecisionTimeline } from './components/VirtualDecisionTimeline';
export type {
  VirtualDecisionTimelineProps,
  TimelineGroupBy,
} from './components/VirtualDecisionTimeline';

// 7.2 — Temporal lens lazy evaluation + cache
export { useTemporalLensCache } from './hooks/useTemporalLensCache';
export type {
  UseTemporalLensCacheResult,
  UseTemporalLensCacheOptions,
} from './hooks/useTemporalLensCache';

// 7.3 — Real-time WebSocket decision stream
export { useDecisionStream } from './hooks/useDecisionStream';
export type {
  UseDecisionStreamOptions,
  UseDecisionStreamResult,
  DecisionStreamFilter,
  DecisionStreamStatus,
} from './hooks/useDecisionStream';

export { DecisionStreamPanel } from './components/DecisionStreamPanel';
export type { DecisionStreamPanelProps } from './components/DecisionStreamPanel';

export { QuestionIntentBar } from './components/QuestionIntentBar';
export type { QuestionIntentBarProps } from './components/QuestionIntentBar';

export { SituationalViewRenderer } from './components/SituationalViewRenderer';
export type { SituationalViewRendererProps } from './components/SituationalViewRenderer';

export { ApprovalWorkflowPanel } from './components/ApprovalWorkflowPanel';
export type { ApprovalWorkflowPanelProps } from './components/ApprovalWorkflowPanel';

export { TemporalProjectionPanel } from './components/TemporalProjectionPanel';
export type { TemporalProjectionPanelProps } from './components/TemporalProjectionPanel';

export { UncertaintyAggregator } from './components/UncertaintyAggregator';
export type { UncertaintyAggregatorProps, UncertaintySource } from './components/UncertaintyAggregator';

// Domain components — travel
export {
  FlightCardExecutive,
  FlightCardOperator,
  FlightCardExpert,
} from './components/domain/travel/FlightCard';
export type { FlightOption } from './components/domain/travel/FlightCard';

// Domain components — cloudops
export { MetricCard } from './components/domain/cloudops/MetricCard';
export type { MetricData } from './components/domain/cloudops/MetricCard';

// Domain components — iot
export { SensorCard } from './components/domain/iot/SensorCard';
export type { SensorReading } from './components/domain/iot/SensorCard';

// Domain components — documents
export { DocumentRenderer, syntaxTokenize } from './components/DocumentRenderer';
export type { DocumentRendererProps } from './components/DocumentRenderer';

// Domain components — forms
export { FormRenderer } from './components/FormRenderer';
export type { FormRendererProps } from './components/FormRenderer';

// Domain components — timeline
export { TimelineRenderer } from './components/TimelineRenderer';
export type { TimelineRendererProps } from './components/TimelineRenderer';

// Domain components — workflow
export { WorkflowRenderer } from './components/WorkflowRenderer';
export type { WorkflowRendererProps } from './components/WorkflowRenderer';

// Domain components — kanban
export { KanbanRenderer } from './components/KanbanRenderer';
export type { KanbanRendererProps } from './components/KanbanRenderer';

// Domain components — calendar
export { CalendarRenderer } from './components/CalendarRenderer';
export type { CalendarRendererProps } from './components/CalendarRenderer';

// Domain components — tree / hierarchy
export { TreeRenderer } from './components/TreeRenderer';
export type { TreeRendererProps } from './components/TreeRenderer';

// Domain components — chat / conversation
export { ChatRenderer } from './components/ChatRenderer';
export type { ChatRendererProps } from './components/ChatRenderer';

// Domain components — diagrams (mermaid, graph, chart)
export { DiagramRenderer } from './components/DiagramRenderer';
export type { DiagramRendererProps } from './components/DiagramRenderer';

// Domain components — map (geographic / spatial)
export { MapRenderer } from './components/MapRenderer';
export type { MapRendererProps } from './components/MapRenderer';

// Hooks
export { useAgentBridge } from './hooks/useAgentBridge';
export type { UseAgentBridgeResult } from './hooks/useAgentBridge';

// Performance utilities
export { useIntersectionMount } from './hooks/useIntersectionMount';
export type { UseIntersectionMountOptions, UseIntersectionMountResult } from './hooks/useIntersectionMount';
export { VirtualFieldList, VIRTUALIZE_THRESHOLD } from './components/VirtualFieldList';

// Voice input
export { useVoiceInput } from './hooks/useVoiceInput';
export type { UseVoiceInputOptions, UseVoiceInputResult, VoiceInputStatus, VoiceInputAppendMode } from './hooks/useVoiceInput';
export { VoiceMicButton } from './components/VoiceMicButton';
export type { VoiceMicButtonProps } from './components/VoiceMicButton';

// Collaborative document editing
export { useDocumentCollaboration, createBroadcastTransport } from './hooks/useDocumentCollaboration';
export type {
  UseDocumentCollaborationOptions,
  UseDocumentCollaborationResult,
  CollaboratorPresenceInfo,
  CollabTransport,
} from './hooks/useDocumentCollaboration';
export { CollaborativeDocumentEditor } from './components/CollaborativeDocumentEditor';
export type { CollaborativeDocumentEditorProps } from './components/CollaborativeDocumentEditor';

// Utilities — color contrast (WCAG 2.2 AA compliance)
export {
  hexToRgb,
  rgbToHex,
  calculateLuminance,
  calculateContrastRatio,
  checkWCAG_AA_Compliance,
  checkWCAG_AAA_Compliance,
  getComplianceSummary,
  getSuggestionsForImprovement,
  validateColorPairs,
} from './utils/colorContrast';
export type {
  ContrastCompliance,
  ContrastComplianceAAA,
  ColorPairValidation,
} from './utils/colorContrast';

// ── Theming ────────────────────────────────────────────────────────────────────
export { ThemeProvider, useTheme } from './ThemeContext';
export {
  lightTheme,
  darkTheme,
  highContrastTheme,
  minimalTheme,
  googleTheme,
  angularTheme,
  reactTheme,
  tailwindTheme,
  spotifyTheme,
  uberTheme,
  BUILT_IN_THEMES,
  ALL_THEMES,
  themeToCSSVars,
} from './theme';
export * from './utils/icon-resolver';
export { ThemeShowcase } from './components/ThemeShowcase';
export type { Theme, ThemeColors, ThemeTypography, ThemeBorderRadius } from './theme';

// ── Primitive Components ──────────────────────────────────────────────────────
export { useToast } from './components/primitives/Toast';
export type { ToastVariant, ToastPosition, ToastItem, ToastContainerProps, UseToastReturn } from './components/primitives/Toast';

export { Modal } from './components/primitives/Modal';
export type { ModalProps, ModalSize } from './components/primitives/Modal';

export { Tooltip } from './components/primitives/Tooltip';
export type { TooltipProps, TooltipPlacement } from './components/primitives/Tooltip';

export { Tabs } from './components/primitives/Tabs';
export type { TabsProps, TabItem } from './components/primitives/Tabs';

export { Accordion } from './components/primitives/Accordion';
export type { AccordionProps, AccordionItem as AccordionItemType } from './components/primitives/Accordion';

export { ProgressBar, Spinner } from './components/primitives/ProgressBar';
export type { ProgressBarProps, SpinnerProps, ProgressVariant, SpinnerSize } from './components/primitives/ProgressBar';

export { Badge } from './components/primitives/Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './components/primitives/Badge';

export { Alert } from './components/primitives/Alert';
export type { AlertProps, AlertVariant } from './components/primitives/Alert';

export { Skeleton, SkeletonGroup } from './components/primitives/Skeleton';
export type { SkeletonProps, SkeletonGroupProps, SkeletonVariant, SkeletonGroupPattern } from './components/primitives/Skeleton';

export { Avatar, AvatarGroup } from './components/primitives/Avatar';
export type { AvatarProps, AvatarGroupProps, AvatarSize, AvatarStatus } from './components/primitives/Avatar';

export { Pagination } from './components/primitives/Pagination';
export type { PaginationProps } from './components/primitives/Pagination';

export { EmptyState } from './components/primitives/EmptyState';
export type { EmptyStateProps } from './components/primitives/EmptyState';

export { Breadcrumb } from './components/primitives/Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItem } from './components/primitives/Breadcrumb';

export { DropdownMenu } from './components/primitives/DropdownMenu';
export type { DropdownMenuProps, DropdownMenuItem, DropdownMenuDivider, DropdownMenuEntry } from './components/primitives/DropdownMenu';

export { DataTable } from './components/primitives/DataTable';
export type { DataTableProps, DataTableColumn, SortDirection } from './components/primitives/DataTable';
