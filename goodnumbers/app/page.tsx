import Hero from '@/components/widgets/Hero';

const heroHome = {
  title: <>A smart weekly journal for type 1 diabetics</>,
  subtitle: (
    <>
      <span className="hidden md:inline">
        <span className="font-semibold decoration-primary-600 decoration-1">GoodNumbers</span>
        &nbsp;is an <span className="underline">experimental</span> weekly journal to help type 1 diabetics reflect and
        improve their blood sugar levels week to week. It uses a mix of good old statistical analysis to help you zero
        in on troublesome trends and identify patterns. It then leverages AI to help you reflect on strategies to
        address them.
      </span>
      <div className="pt-4">
        Use it for self-reflection, to find your blind spots in your diabetes management, and to continuously improve.
      </div>
    </>
  ),
  callToAction: {
    text: 'Try Nightscout Demo',
    href: 'trynow',
    // icon: IconBrandApplePodcast,
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
