import styles from './Hero.module.css';
import { ArrowRight, Play } from 'lucide-react';

export default function Hero() {
    return (
        <section className={styles.hero}>
            <div className={styles.grainOverlay}></div>
            <div className={styles.glowOrb1}></div>
            <div className={styles.glowOrb2}></div>

            <div className={`${styles.content} animate-fade-in`}>
                <div className={styles.badge}>
                    <span className={styles.badgeDot}></span>
                    Texas&apos; #1 Luxury Detailers
                </div>

                <h1 className={styles.title}>
                    Your Car Deserves<br />
                    <span className={styles.highlight}>Elite Treatment</span>
                </h1>

                <p className={styles.description}>
                    Book your premium mobile detail in 60 seconds. Our AI Maya handles
                    everything 24/7. We come to you.
                </p>

                <div className={styles.actions}>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}
                    >
                        Start Booking
                        <ArrowRight size={18} />
                    </button>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => window.scrollTo({ top: document.getElementById('services')?.offsetTop || 0, behavior: 'smooth' })}
                    >
                        View Services
                    </button>
                </div>

                <div className={styles.trustBar}>
                    <div className={styles.trustItem}>
                        <span className={styles.trustNumber}>2,400+</span>
                        <span className={styles.trustLabel}>Details Completed</span>
                    </div>
                    <div className={styles.trustDivider}></div>
                    <div className={styles.trustItem}>
                        <span className={styles.trustNumber}>4.9</span>
                        <span className={styles.trustLabel}>Google Rating</span>
                    </div>
                    <div className={styles.trustDivider}></div>
                    <div className={styles.trustItem}>
                        <span className={styles.trustNumber}>24/7</span>
                        <span className={styles.trustLabel}>AI Concierge</span>
                    </div>
                </div>
            </div>

            <div className={styles.scrollIndicator}>
                <div className={styles.scrollLine}></div>
            </div>
        </section>
    );
}
