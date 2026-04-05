import React, { useState } from 'react';
import { MessageSquare, Star, User } from 'lucide-react';

export const CsatReport = ({ csatData }) => {
  const [scoreFilter, setScoreFilter] = useState('');

  const filteredData = csatData.filter(item => {
    const ratingStr = item['Conversation rating'];
    if (!ratingStr) return false;
    if (scoreFilter && ratingStr !== scoreFilter) return false;
    return true;
  });

  return (
    <div className="csat-report glass-panel">
      <div className="csat-header">
        <h3 className="chart-title" style={{ marginBottom: 0 }}>CSAT Report Feed</h3>
        <select 
          className="filter-input glass-input"
          value={scoreFilter} 
          onChange={(e) => setScoreFilter(e.target.value)}
        >
          <option value="">All Scores</option>
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Okay</option>
          <option value="2">2 - Bad</option>
          <option value="1">1 - Terrible</option>
        </select>
      </div>

      <div className="csat-feed">
        {filteredData.map((review, index) => {
          const score = parseInt(review['Conversation rating'] || '0');
          const isPositive = score >= 4;
          const isNeutral = score === 3;
          let badgeColor = isPositive ? '#10b981' : isNeutral ? '#f59e0b' : '#ef4444';

          return (
            <div key={index} className="review-card">
              <div className="review-meta">
                <div className="review-stars" style={{ color: badgeColor }}>
                  {Array.from({ length: score }).map((_, i) => (
                    <Star key={i} size={16} fill={badgeColor} />
                  ))}
                  <span className="review-score-text">({score}/5)</span>
                </div>
                <span className="review-date">{review['Updated at (America/New_York)']}</span>
              </div>
              
              {review['Conversation rating remark'] ? (
                 <p className="review-remark">"{review['Conversation rating remark']}"</p>
              ) : (
                 <p className="review-remark empty-remark">No written feedback provided.</p>
              )}
              
              <div className="review-footer">
                <div className="review-user">
                  <User size={14} />
                  <span>{review['User name'] || 'Anonymous'}</span>
                </div>
                <div className="review-agent">
                  <span>Assigned to: {review['Teammate rated'] || 'Unknown'}</span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredData.length === 0 && (
          <div className="empty-state">No feedback found for the selected filter.</div>
        )}
      </div>
    </div>
  );
};
