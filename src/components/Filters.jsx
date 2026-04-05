import React from 'react';
import { Filter } from 'lucide-react';

export const Filters = ({ availableTeams, availableTeammates, filters, onFilterChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="filters-bar glass-panel">
      <div className="filter-group">
        <Filter size={18} style={{ color: '#8b5cf6' }} />
        <span className="filter-label">Filters:</span>
      </div>
      
      <div className="filter-controls">
        <div className="filter-input-group">
          <label>Start Date</label>
          <input 
            type="date" 
            name="startDate" 
            value={filters.startDate} 
            onChange={handleChange} 
            className="filter-input glass-input"
          />
        </div>
        
        <div className="filter-input-group">
          <label>End Date</label>
          <input 
            type="date" 
            name="endDate" 
            value={filters.endDate} 
            onChange={handleChange} 
            className="filter-input glass-input"
          />
        </div>

        <div className="filter-input-group">
          <label>Team</label>
          <select 
            name="team" 
            value={filters.team} 
            onChange={handleChange}
            className="filter-input glass-input"
          >
            <option value="">All Teams</option>
            {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="filter-input-group">
          <label>Teammate</label>
          <select 
            name="teammate" 
            value={filters.teammate} 
            onChange={handleChange}
            className="filter-input glass-input"
          >
            <option value="">All Teammates</option>
            {availableTeammates.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};
