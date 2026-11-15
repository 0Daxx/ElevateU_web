import React from 'react';
import { MessageSquare } from 'lucide-react';
import Card from '../components/ui/Card';
import SEO from '../components/SEO';

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SEO title="Feedback" />
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">ElevateU</p><h1 className="mt-1 text-3xl font-extrabold">Send Feedback</h1></div>
      <Card className="flex items-start gap-4 p-6 sm:p-8"><span className="rounded-xl bg-accent/10 p-3 text-accent"><MessageSquare className="h-5 w-5" /></span><div><h2 className="font-bold">Feedback is coming soon</h2><p className="mt-2 text-sm leading-relaxed text-text-secondary">We’re preparing a place to share ideas and report issues. Thanks for helping us improve ElevateU.</p></div></Card>
    </div>
  );
}
