import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, useReducedMotion, animate } from 'framer-motion';

const STATS = [
  { label: 'Students Guided', value: 10000, prefix: '', suffix: '+' },
  { label: 'Career Paths Mapped', value: 500, prefix: '', suffix: '+' },
  { label: 'Courses Curated', value: 1200, prefix: '', suffix: '+' },
  { label: 'Assessment Accuracy', value: 95, prefix: '', suffix: '%' },
];

function CountUp({ target, inView }) {
  const [count, setCount] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setCount(target);
      return;
    }

    if (inView) {
      const controls = animate(0, target, {
        duration: 2,
        ease: "easeOut",
        onUpdate(value) {
          setCount(Math.floor(value));
        }
      });
      return () => controls.stop();
    }
  }, [inView, target, shouldReduceMotion]);

  return <>{count.toLocaleString()}</>;
}

export default function StatsStrip() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden bg-primary px-6 py-16 sm:px-10 sm:py-20"
      style={{ backgroundImage: "linear-gradient(90deg, rgba(25,61,67,.94), rgba(33,99,89,.88)), url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2200&q=80')", backgroundPosition: 'center', backgroundSize: 'cover' }}
    >
      <motion.div 
        className="max-w-7xl mx-auto grid grid-cols-2 gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
        variants={containerVariants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        {STATS.map((stat, index) => (
          <motion.div 
            key={index} 
            className="flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-6 text-center backdrop-blur-[2px] sm:py-8"
            variants={itemVariants}
          >
            <h3 className="mb-2 text-3xl font-black tracking-tight text-amber-300 sm:text-5xl">
              {stat.prefix}
              <CountUp target={stat.value} inView={inView} />
              {stat.suffix}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/90 sm:text-xs sm:tracking-[0.18em]">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
