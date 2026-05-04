import React, { memo } from 'react';

export const InitiativesPanel = memo(({ viewModel, onOpenRecommendations }) => {
  const initiativeCount = viewModel?.initiatives?.length || 0;
  const topInitiatives = viewModel?.summaryCard?.topInitiatives || [];

  return (
    <section className="initiative-summary-card glass-panel">
      <div className="initiative-summary-header">
        <div>
          <p className="initiative-eyebrow">AI Suggested Initiatives</p>
          <h3>{initiativeCount} recommendations identified</h3>
        </div>
        <button
          type="button"
          className="initiative-entrypoint-button"
          onClick={onOpenRecommendations}
        >
          View AI Recommendations →
        </button>
      </div>

      {topInitiatives.length > 0 ? (
        <div className="initiative-summary-preview-list">
          {topInitiatives.map((initiative) => (
            <div key={initiative.initiative_id} className="initiative-summary-preview-item">
              <strong>{initiative.problem?.summary || initiative.title}</strong>
              <span>
                {initiative.impact?.volume ?? 0} conversations • {initiative.impact?.severity || 'low'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="initiative-empty-state">
          No recommendations are available for the selected reporting window yet.
        </div>
      )}
    </section>
  );
});
