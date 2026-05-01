export const formatMinutes = (value = 0) => `${Number(value || 0).toFixed(Number.isInteger(value) ? 0 : 1)} min`;

export const formatDateTime = (value) => {
  if (!value) return 'Not available';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const formatHour = (hour) => `${String(hour).padStart(2, '0')}:00`;
