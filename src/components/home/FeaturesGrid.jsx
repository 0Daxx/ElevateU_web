import React, { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { ClipboardList, Target, AlertTriangle, FileText, Map, MessageCircle } from 'lucide-react';

const FEATURES = [
  {
    title: 'AI Skill Assessments',
    description: 'Dynamic tests that adapt to your level and accurately gauge your current knowledge.',
    icon: ClipboardList,
    variant: 'primary'
  },
  {
    title: 'Career Recommendations',
    description: 'Discover your perfect career matches based on your unique skills and interests.',
    icon: Target,
    variant: 'secondary'
  },
  {
    title: 'Skill Gap Analysis',
    description: 'Instantly see what you need to learn to bridge the gap to your dream role.',
    icon: AlertTriangle,
    variant: 'info'
  },
  {
    title: 'Resume Analysis',
    description: 'Get actionable feedback on your resume to stand out to top recruiters.',
    icon: FileText,
    variant: 'success'
  },
  {
    title: 'Personalized Roadmaps',
    description: 'Follow a curated, step-by-step learning path designed exclusively for you.',
    icon: Map,
    variant: 'warning'
  },
  {
    title: '24/7 AI Chatbot',
    description: 'Never get stuck again. Your personal AI mentor is available around the clock.',
    icon: MessageCircle,
    variant: 'danger'
  }
];

export default function FeaturesGrid() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
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
    <section id="features" className="relative overflow-hidden bg-bg-page px-5 py-20 sm:px-10 sm:py-28">
      <div className="max-w-7xl mx-auto">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <Badge variant="warning" className="mb-4 px-4 py-1.5 text-xs font-bold uppercase tracking-wider">Explore ElevateU</Badge>
          <h2 className="mb-4 text-3xl font-black tracking-tight text-text-primary sm:text-5xl">
            Learn with purpose. Grow with confidence.
          </h2>
          <p className="text-base leading-7 text-text-secondary sm:text-lg">
            Practical guidance and learning tools to help you move from possibility to progress.
          </p>
        </div>

        <motion.div 
          ref={ref}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            const topBorders = {
              primary: 'border-t-primary',
              secondary: 'border-t-secondary',
              info: 'border-t-accent',
              success: 'border-t-success',
              warning: 'border-t-warning',
              danger: 'border-t-danger',
            };

            return (
              <motion.div key={index} variants={itemVariants}>
                <Card 
                  className={`group h-full rounded-2xl border border-border bg-bg-surface p-6 shadow-[0_8px_30px_rgba(26,46,83,0.045)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(26,46,83,0.12)] sm:p-7 ${topBorders[feature.variant]}`}
                >
                  <div className="mb-6 flex items-start justify-between">
                    <Badge variant={feature.variant} className="rounded-2xl p-4 transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-7 w-7" />
                    </Badge>
                    <span className="font-serif text-2xl text-secondary/70">0{index + 1}</span>
                  </div>
                  <h3 className="mb-2 text-xl font-extrabold text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-6 text-text-secondary sm:text-base">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
