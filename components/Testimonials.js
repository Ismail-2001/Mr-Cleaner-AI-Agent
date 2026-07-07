'use client';

import styles from './Testimonials.module.css';
import { Star, Quote } from 'lucide-react';

const testimonials = [
    {
        name: 'James Richardson',
        role: 'BMW M4 Owner',
        text: 'Maya understood exactly what my car needed. The ceramic coating came out flawless. Best detailing experience in Austin.',
        rating: 5,
        location: 'Austin, TX'
    },
    {
        name: 'Sarah Chen',
        role: 'Tesla Model S Owner',
        text: 'Booked through the AI at 2 AM, had my appointment confirmed in minutes. The attention to detail was extraordinary.',
        rating: 5,
        location: 'Dallas, TX'
    },
    {
        name: 'Michael Torres',
        role: 'Porsche Cayenne Owner',
        text: 'They transformed my SUV from neglected to showroom condition. The paint correction alone was worth every penny.',
        rating: 5,
        location: 'Houston, TX'
    }
];

export default function Testimonials() {
    return (
        <section className={styles.section}>
            <div className="container">
                <div className={styles.header}>
                    <span className={styles.badge}>Client Stories</span>
                    <h2 className={styles.title}>Trusted by Texas&apos; Finest</h2>
                    <p className={styles.subtitle}>
                        Hear from vehicle owners who trust us with their most prized possessions.
                    </p>
                </div>

                <div className={styles.grid}>
                    {testimonials.map((t, i) => (
                        <div key={i} className={`${styles.card} reveal reveal-delay-${i + 1}`}>
                            <div className={styles.quoteIcon}>
                                <Quote size={24} />
                            </div>
                            <div className={styles.stars}>
                                {[...Array(t.rating)].map((_, j) => (
                                    <Star key={j} size={16} fill="var(--gold)" color="var(--gold)" />
                                ))}
                            </div>
                            <p className={styles.text}>&ldquo;{t.text}&rdquo;</p>
                            <div className={styles.author}>
                                <div className={styles.avatar}>{t.name.charAt(0)}</div>
                                <div>
                                    <div className={styles.name}>{t.name}</div>
                                    <div className={styles.role}>{t.role} &middot; {t.location}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
