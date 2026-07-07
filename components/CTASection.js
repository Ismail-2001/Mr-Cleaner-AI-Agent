'use client';

import styles from './CTASection.module.css';
import { ArrowRight, MessageSquare } from 'lucide-react';

export default function CTASection() {
    return (
        <section className={styles.section}>
            <div className={styles.bgGlow}></div>
            <div className="container">
                <div className={styles.content}>
                    <span className={styles.badge}>Ready to Begin?</span>
                    <h2 className={styles.title}>
                        Your Vehicle Deserves<br />
                        <span className={styles.gold}>Elite Care</span>
                    </h2>
                    <p className={styles.description}>
                        Chat with Maya, our AI concierge, to get a personalized quote
                        and book your appointment in under 60 seconds.
                    </p>
                    <div className={styles.actions}>
                        <button
                            className={styles.primaryBtn}
                            onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}
                        >
                            <MessageSquare size={18} />
                            Chat with Maya
                        </button>
                        <a href="tel:+15074797804" className={styles.secondaryBtn}>
                            Call Us Now
                            <ArrowRight size={16} />
                        </a>
                    </div>
                    <p className={styles.note}>
                        No commitment required. Get your personalized quote in seconds.
                    </p>
                </div>
            </div>
        </section>
    );
}
