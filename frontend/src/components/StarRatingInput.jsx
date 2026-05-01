import { Star } from 'lucide-react';
import styles from './StarRatingInput.module.css';

export default function StarRatingInput({ value, onChange }) {
  return (
    <div className={styles.rating}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          className={`${styles.star} ${score <= value ? styles.active : ''}`}
          onClick={() => onChange(score)}
        >
          <Star size={20} fill={score <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}
