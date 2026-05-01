import styles from './GlassPanel.module.css';

export default function GlassPanel({
  title,
  eyebrow,
  action,
  children,
  className = '',
}) {
  return (
    <section className={`${styles.panel} ${className}`.trim()}>
      {(title || eyebrow || action) && (
        <header className={styles.header}>
          <div>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            {title && <h2 className={styles.title}>{title}</h2>}
          </div>
          {action ? <div>{action}</div> : null}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}
