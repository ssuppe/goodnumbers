import Hero from '@/components/widgets/Hero';

const heroHome = {
  title: <>Personalized podcast about your weekly diabetes numbers</>,
  subtitle: (
    <>
      <span className="hidden md:inline">
        <span className="font-semibold underline decoration-primary-600 decoration-wavy decoration-1 underline-offset-2">
          GoodNumbers
        </span>{' '}
        is an experimental weekly personalized podcast about your blood sugar levels. We use non-AI statistical
        algorithms to analyze your blood sugar levels and creates an AI-generated podcast for you to listen to,
        discussing your highs, lows, and strategies to address them. Use it for self-reflection, to find your blind
        spots to your diabetes management, and to continuously improve.
      </span>
    </>
  ),
  callToAction: {
    text: 'Try Demo',
    href: 'trynow',
    icon: undefined, //IconBrandApplePodcast,
    targetBlank: false,
  },
  callToAction2: {
    text: 'Learn more',
    href: '/about',
  },
};

export default function Page() {
  return (
    <>
      <Hero {...heroHome} />
    </>
  );
}
