import styles from './ValueProps.module.css';
import { Award, Timer, Target, Gem } from 'lucide-react';

export default function ValueProps() {
    const props = [
        {
            icon: <Gem size={28} />,
            title: "Concierge Quality",
            desc: "Every inch of your vehicle is treated with boutique-grade products and master precision."
        },
        {
            icon: <Timer size={28} />,
            title: "Time Autonomy",
            desc: "We bring the showroom to you. Stay focused while Maya manages logistics and scheduling."
        },
        {
            icon: <Target size={28} />,
            title: "Obsessive Detail",
            desc: "From engine bays to door jambs, our signature processes leave no surface untouched."
        },
        {
            icon: <Award size={28} />,
            title: "Certified Protection",
            desc: "Authorized installers of elite ceramic coatings with multi-year performance guarantees."
        }
    ];

    return (
        <section className={styles.section}>
            <div className="container">
                <div className={styles.header}>
                    <span className={styles.badge}>Why Mr. Cleaner</span>
                    <h2 className={styles.title}>The Elite Difference</h2>
                </div>
                <div className={styles.grid}>
                    {props.map((prop, i) => (
                        <div key={i} className={`${styles.card} reveal reveal-delay-${i + 1}`}>
                            <div className={styles.iconWrapper}>{prop.icon}</div>
                            <h3>{prop.title}</h3>
                            <p>{prop.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
