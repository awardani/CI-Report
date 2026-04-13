import React from 'react';

export const DataQualityPanel = ({ diagnostics }) => {
  return (
    <details className="data-quality-panel glass-panel">
      <summary>Data Quality & Diagnostics</summary>

      {diagnostics.sourceMeta && (
        <div className="diagnostics-source-meta">
          <span>
            Mode: <strong>{diagnostics.sourceMeta.mode}</strong>
          </span>
          <span>
            Adapter: <strong>{diagnostics.sourceMeta.adapterId}</strong>
          </span>
          <span>
            Source kind: <strong>{diagnostics.sourceMeta.sourceKind}</strong>
          </span>
          {diagnostics.sourceMeta.meta?.apiSummary?.requestCount != null && (
            <span>
              Requests: <strong>{diagnostics.sourceMeta.meta.apiSummary.requestCount}</strong>
            </span>
          )}
          {diagnostics.sourceMeta.meta?.apiSummary?.datasetCacheHit != null && (
            <span>
              Dataset cache: <strong>{diagnostics.sourceMeta.meta.apiSummary.datasetCacheHit ? 'hit' : 'miss'}</strong>
            </span>
          )}
        </div>
      )}

      <div className="diagnostics-grid">
        <section>
          <h4>Source Rows</h4>
          <ul className="diagnostics-list">
            {diagnostics.sourceRows.map((row) => (
              <li key={row.datasetKey}>
                <span>{row.label}</span>
                <strong>{row.rowCount.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4>Normalized Models</h4>
          <ul className="diagnostics-list">
            <li>
              <span>conversations</span>
              <strong>{diagnostics.normalizedRows.conversations.toLocaleString()}</strong>
            </li>
            <li>
              <span>ratings</span>
              <strong>{diagnostics.normalizedRows.ratings.toLocaleString()}</strong>
            </li>
            <li>
              <span>fin_outcomes</span>
              <strong>{diagnostics.normalizedRows.fin_outcomes.toLocaleString()}</strong>
            </li>
          </ul>
        </section>

        <section>
          <h4>Join & Metadata</h4>
          <ul className="diagnostics-list">
            <li>
              <span>Unmatched rating joins</span>
              <strong>{diagnostics.joinStats.unmatchedRatings.toLocaleString()}</strong>
            </li>
            <li>
              <span>Missing rating team metadata</span>
              <strong>{diagnostics.metadataStats.ratingsMissingTeamMetadata.toLocaleString()}</strong>
            </li>
            <li>
              <span>Missing rating teammate metadata</span>
              <strong>{diagnostics.metadataStats.ratingsMissingTeammateMetadata.toLocaleString()}</strong>
            </li>
            <li>
              <span>Missing rated teammate metadata</span>
              <strong>
                {diagnostics.metadataStats.teammateRatingsMissingRatedTeammateMetadata.toLocaleString()}
              </strong>
            </li>
          </ul>
        </section>

        <section>
          <h4>Metric Support</h4>
          <ul className="diagnostics-list metric-support-list">
            {diagnostics.metricSupport.map((metric) => (
              <li key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.supportLabel}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="diagnostics-warnings">
        <h4>Warnings</h4>
        {diagnostics.warnings.length > 0 ? (
          <ul className="diagnostics-warning-list">
            {diagnostics.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>No validation warnings detected.</p>
        )}
      </div>

      {diagnostics.sourceMeta?.meta?.envMask && (
        <div className="diagnostics-warnings">
          <h4>Source Config</h4>
          <ul className="diagnostics-list">
            <li>
              <span>Client ID present</span>
              <strong>{String(diagnostics.sourceMeta.meta.envMask.clientIdPresent)}</strong>
            </li>
            <li>
              <span>Client secret present</span>
              <strong>{String(diagnostics.sourceMeta.meta.envMask.clientSecretPresent)}</strong>
            </li>
            <li>
              <span>Access token present</span>
              <strong>{String(diagnostics.sourceMeta.meta.envMask.accessTokenPresent)}</strong>
            </li>
            <li>
              <span>API host</span>
              <strong>{diagnostics.sourceMeta.meta.envMask.apiBaseUrlHost}</strong>
            </li>
            {diagnostics.sourceMeta.meta?.apiSummary?.initialBackfillDays != null && (
              <li>
                <span>Initial backfill window</span>
                <strong>{diagnostics.sourceMeta.meta.apiSummary.initialBackfillDays} days</strong>
              </li>
            )}
            {diagnostics.sourceMeta.meta?.apiSummary?.adminCacheHit != null && (
              <li>
                <span>Admin lookup cache</span>
                <strong>{diagnostics.sourceMeta.meta.apiSummary.adminCacheHit ? 'hit' : 'miss'}</strong>
              </li>
            )}
            {diagnostics.sourceMeta.meta?.apiSummary?.teamCacheHit != null && (
              <li>
                <span>Team lookup cache</span>
                <strong>{diagnostics.sourceMeta.meta.apiSummary.teamCacheHit ? 'hit' : 'miss'}</strong>
              </li>
            )}
          </ul>
        </div>
      )}
    </details>
  );
};
