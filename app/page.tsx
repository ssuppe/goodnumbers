import type { Metadata } from 'next';

import { SITE } from '~/config.js';

import Hero from '~/components/widgets/Hero';

// import SocialProof from '../src/components/widgets/SocialProof';
// import Features from '~/components/widgets/Features';
// import Content from '~/components/widgets/Content';
// import Steps from '~/components/widgets/Steps';
// import Testimonials from '~/components/widgets/Testimonials';
// import FAQs2 from '~/components/widgets/FAQs2';
// import Pricing from '~/components/widgets/Pricing';
// import Team from '~/components/widgets/Team';
// import CallToAction2 from '~/components/widgets/CallToAction2';
// import Contact from '~/components/widgets/Contact';
// import {
//   callToAction2Home,
//   // contactHome,
//   contentHomeOne,
//   contentHomeTwo,
//   faqs2Home,
//   featuresHome,
//   heroHome,
//   pricingHome,
//   socialProofHome,
//   stepsHome,
//   teamHome,
//   testimonialsHome,
// } from '~/shared/data/pages/home.data';

export const metadata: Metadata = {
  title: SITE.title,
};

const heroHome = {
  title: (
    <>
      Personalized podcast about your weekly diabetes numbers
    </>
  ),
  subtitle: (
    <>
      <span className="hidden md:inline">
        <span className="font-semibold underline decoration-primary-600 decoration-wavy decoration-1 underline-offset-2">
          GoodNumbers
        </span>{' '}
        is an experimental weekly personalized podcast about your blood sugar levels. We use non-AI statistical algorithms to analyze
        your blood sugar levels and creates an AI-generated podcast for you to listen to, discussing your highs, lows, and strategies
        to address them. Use it for self-reflection, to find your blind spots to your diabetes managements, and to continuously improve.
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
  // image: {
  //   src: heroImg,
  //   alt: 'Hero TailNext',
  // },
};




export default function Page() {
  return (
    <>
      <Hero {...heroHome} />
      {/* <SocialProof {...socialProofHome} /> */}
      {/* <Features {...featuresHome} /> */}
      {/* <Content {...contentHomeOne} /> */}
      {/* <Content {...contentHomeTwo} /> */}
      {/* <Steps {...stepsHome} /> */}
      {/* <Testimonials {...testimonialsHome} /> */}
      {/* <FAQs2 {...faqs2Home} /> */}
      {/* <Pricing {...pricingHome} /> */}
      {/* <Team {...teamHome} /> */}
      {/* <Contact {...contactHome} /> */}
      {/* <CallToAction2 {...callToAction2Home} /> */}
    </>
  );
}
