'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './StatsCounter.module.css';

function AnimatedNumber({ target, suffix = '', prefix = '' }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const duration = 2000;
                    const steps = 60;
                    const increment = target / steps;
                    let current = 0;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            setCount(target);
                            clearInterval(timer);
                        } else {
                            setCount(Math.floor(current));
                        }
                    }, duration / steps);
                }
            },
            { threshold: 0.5 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);

    return (
        <span ref={ref} className={styles.number}>
            {prefix}{count.toLocaleString()}{suffix}
        </span>
    );
}

const stats = [
    { number: 2400, suffix: '+', label: 'Details Completed', description: 'Premium vehicles serviced' },
    { number: 98, suffix: '%', label: 'Satisfaction Rate', description: 'Five-star reviews' },
    { number: 45, suffix: 'min', label: 'Average Booking', description: 'From chat to confirmed' },
    { number: 3, suffix: 'x', label: 'Revenue Growth', description: 'Since AI integration' },
];

export default function StatsCounter() {
    return (
        <section className={styles.section}>
            <div className="container">
                <div className={styles.grid}>
                    {stats.map((stat, i) => (
                        <div key={i} className={`${styles.card} reveal reveal-delay-${i + 1}`}>
                            <AnimatedNumber target={stat.number} suffix={stat.suffix} />
                            <div className={styles.label}>{stat.label}</div>
                            <div className={styles.description}>{stat.description}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
