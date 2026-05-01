import { createElement } from 'react';
import styles from './MetricCard.module.css';

export default function MetricCard({
  icon,
  label,
  value,
  accent = 'warm',
  helper,
}) {
  return (
    <article className={`${styles.card} ${styles[accent]}`}>
      <div className={styles.iconWrap}>
        {icon ? createElement(icon, { size: 20 }) : null}
      </div>
      <p className={styles.label}>{label}</p>
      <h3 className={styles.value}>{value}</h3>
      {helper ? <p className={styles.helper}>{helper}</p> : null}
    </article>
  );
}
