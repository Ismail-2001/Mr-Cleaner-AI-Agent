import styles from './ServiceMenu.module.css';
import { Check, ArrowRight } from 'lucide-react';

const SERVICES = [
    {
        id: 'basic',
        title: 'Executive Preservation',
        price: '$120',
        priceSuffix: ' starting',
        duration: '1.5 Hours',
        features: ['Boutique Hand Wash', 'Tire Glaze & Dressing', 'Crystal Window Finish', 'Ceramic Spray Sealant'],
    },
    {
        id: 'premium',
        title: 'The Master Detail',
        price: '$250',
        priceSuffix: ' starting',
        duration: '3.5 Hours',
        popular: true,
        features: ['Everything in Executive', 'Decontamination Wash', 'Single-Stage Paint Correction', 'Deep Interior Extraction', 'Leather Hydration Treatment'],
    },
    {
        id: 'full',
        title: 'Signature Ceramic',
        price: '$450',
        priceSuffix: ' starting',
        duration: '6+ Hours',
        features: ['Everything in Master', 'Engine Room Detailing', 'Multi-Stage Paint Correction', '3-Year Ceramic Coating', 'Fabric Protection'],
    }
];

export default function ServiceMenu() {
    return (
        <section id="services" className={styles.section}>
            <div className="container">
                <div className={`${styles.header} reveal`}>
                    <span className={styles.badge}>Our Packages</span>
                    <h2 className={styles.title}>Detailing Packages</h2>
                    <p className={styles.subtitle}>Choose the level of care your vehicle needs</p>
                </div>

                <div className={styles.grid}>
                    {SERVICES.map((service, i) => (
                        <div key={service.id} className={`${styles.card} ${service.popular ? styles.popular : ''} reveal reveal-delay-${i + 1}`}>
                            {service.popular && <div className={styles.popBadge}>Most Popular</div>}
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>{service.title}</h3>
                                <div className={styles.priceContainer}>
                                    <span className={styles.price}>{service.price}</span>
                                    <span className={styles.suffix}>{service.priceSuffix}</span>
                                </div>
                                <span className={styles.duration}>{service.duration}</span>
                            </div>
                            <ul className={styles.features}>
                                {service.features.map((feature, j) => (
                                    <li key={j} className={styles.feature}>
                                        <Check size={16} className={styles.icon} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button
                                className={service.popular ? styles.activeBtn : styles.btn}
                                onClick={() => window.dispatchEvent(new CustomEvent('open-chat', { detail: { service: service.title } }))}
                            >
                                Book This Service
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
