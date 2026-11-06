import { useState, useEffect } from 'react';
import { useBooking } from '../../context/BookingContext';
import { Search, X } from 'lucide-react';

export function NaturalSearch({ onSearch, onResults, placeholder = "Search rooms or try: 'free rooms tomorrow 2pm'" }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);

  const { naturalLanguageSearch } = useBooking();

  useEffect(() => {
    if (query.length > 2) {
      setIsSearching(true);
      const debounceTimer = setTimeout(() => {
        const searchResults = naturalLanguageSearch(query);
        setResults(searchResults);
        onResults && onResults(searchResults);
        setIsSearching(false);
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setResults(null);
      onResults && onResults(null);
    }
  }, [query, naturalLanguageSearch]);

  const handleSearch = (e) => {
    setQuery(e.target.value);
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    onResults && onResults(null);
  };

  const getIntentIcon = (intent) => {
    const icons = {
      availability: '📅',
      booking: '📝',
      conflict: '⚠️',
      alternatives: '🔄',
    };
    return icons[intent] || '🔍';
  };

  const getIntentColor = (intent) => {
    const colors = {
      availability: '#10b981',
      booking: '#3b82f6',
      conflict: '#f59e0b',
      alternatives: '#8b5cf6',
    };
    return colors[intent] || '#6b7280';
  };

  return (
    <div className="natural-search">
      <div className="search-input-wrapper">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder={placeholder}
          className="search-input"
        />
        {query && (
          <button className="search-clear" onClick={clearSearch}>
            <X size={16} />
          </button>
        )}
        {isSearching && (
          <div className="searching-indicator">
            <div className="spinner" />
          </div>
        )}
      </div>

      {results && (
        <div className="search-results">
          {results.intent && (
            <div className="search-intent">
              <span className="intent-icon">{getIntentIcon(results.intent)}</span>
              <span className="intent-label">Detected: {results.intent}</span>
            </div>
          )}

          {results.suggestions && results.suggestions.length > 0 && (
            <div className="suggestions-section">
              <h4>Quick Suggestions</h4>
              <div className="suggestions-list">
                {results.suggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="suggestion-item">
                    <span className="suggestion-time">{suggestion.timeSlot.label}</span>
                    <span className="suggestion-count">
                      {suggestion.availableRooms.length} rooms available
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.rooms && results.rooms.length > 0 && (
            <div className="rooms-section">
              <h4>Room Results</h4>
              <div className="rooms-list">
                {results.rooms.slice(0, 3).map(room => (
                  <div key={room.id} className="room-result-item">
                    <span className="room-name">{room.name}</span>
                    <span className="room-info">
                      {room.buildingId} • Floor {room.floor} • {room.capacity} seats
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.intent === 'availability' && (
            <div className="availability-help">
              <p><strong>Tried it already? Try:</strong></p>
              <ul>
                <li>&quot;free rooms tomorrow morning&quot;</li>
                <li>&quot;available labs today&quot;</li>
                <li>&quot;seminars next week&quot;</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}