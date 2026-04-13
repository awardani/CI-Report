const SUPPORT_LABELS = {
  full: 'Fully supported',
  partial: 'Partially limited',
};

export const buildDiagnosticsViewModel = (validationReport, metricResults, sourceMeta = null) => ({
  sourceMeta,
  sourceRows: Object.entries(validationReport.sourceValidations).map(([datasetKey, validation]) => ({
    datasetKey,
    label: validation.label,
    rowCount: validation.rowCount,
  })),
  normalizedRows: validationReport.normalizedSummary.rowCounts,
  joinStats: validationReport.normalizedSummary.joinStats,
  metadataStats: validationReport.normalizedSummary.metadataStats,
  warnings: [
    ...validationReport.warnings,
    ...(sourceMeta?.meta?.warnings || []),
    ...(sourceMeta?.meta?.capabilities?.newConversationsProxyBased
      ? ['New Conversations remains proxy-based in this source mode.']
      : []),
    ...(sourceMeta?.meta?.capabilities?.initialBackfillLimited
      ? [
          `API mode initial load is limited to the most recent ${sourceMeta?.meta?.apiSummary?.initialBackfillDays ?? 'configured'} days for faster first render.`,
        ]
      : []),
    ...(sourceMeta?.meta?.capabilities?.overallCsatMayMissChatbotRatings
      ? ['Overall CSAT in API mode may be partial if chatbot ratings are not exposed by the Intercom conversation endpoints.']
      : []),
  ],
  metricSupport: Object.values(metricResults).map((metric) => ({
    id: metric.id,
    label: metric.label,
    supportLevel: metric.supportLevel,
    supportLabel: SUPPORT_LABELS[metric.supportLevel] ?? metric.supportLevel,
    limitations: metric.limitations,
    assumptions: metric.assumptions,
  })),
});
