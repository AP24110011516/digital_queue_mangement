import styles from './StatusBadge.module.css';

const statusClassMap = {
  waiting: styles.waiting,
  called: styles.called,
  completed: styles.completed,
  expired: styles.expired,
  active: styles.active,
  inactive: styles.inactive,
  normal: styles.normal,
  senior: styles.senior,
  emergency: styles.emergency,
};

const labels = {
  senior: 'Senior citizen',
};

export default function StatusBadge({ value }) {
  const normalized = (value || 'unknown').toLowerCase();

  return (
    <span className={`${styles.badge} ${statusClassMap[normalized] || ''}`}>
      {labels[normalized] || value}
    </span>
  );
}
