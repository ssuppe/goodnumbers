'use client';

import WidgetWrapper from '@/components/atoms/WidgetWrapper';
import Headline from '@/components/atoms/Headline';

const Page = () => {
  const header = {
    title: 'Terms and Conditions',
  };

  return (
    <>
      <WidgetWrapper hasBackground={true}>
        <Headline header={header} />
        <div className="max-w-3xl mx-auto">
          <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-headings:text-primary-700 dark:prose-headings:text-primary-400 prose-p:text-gray-700 dark:prose-p:text-slate-300">
            <h2 className="text-xl font-semibold mt-8 mb-4">Terms and Conditions for Goodnumbers</h2>
            <p className="mb-4">Last Updated: April 19, 2025</p>
            <p className="mb-4 font-semibold text-red-600 dark:text-red-400">
              In short: Goodnumbers is NOT medical advice. Always speak to a healthcare professional before making
              changes to your healthcare plan. Goodnumbers is a personal experimental project and very likely wrong. You
              accept all responsibility and liability for its use.
            </p>
            <p className="mb-4">
              Welcome to Goodnumbers. Using this website and service ("Service") means you agree to these Terms and
              Conditions ("Terms"). If you don't agree, please don't use the Service.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Experimental Service & No Warranty</h2>
            <p className="mb-4">
              Goodnumbers is an experimental project exploring software and AI (artificial intelligence). It's a
              personal project and likely to be fast-changing and incorrect.
            </p>
            <p className="mb-4">
              The Service is provided "AS IS" without any warranty. We don't guarantee it will be accurate, reliable,
              secure, or always available. It might have errors or be broken.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Not Medical Advice</h2>
            <p className="mb-4">
              Information from Goodnumbers, including AI analysis of your CGM, meal data, etc., is for informational and
              educational purposes only, and to help understand how artificial intelligence understands (or does not
              understand) diabetes.
            </p>
            <p className="mb-4  text-red-600 dark:text-red-400">
              Goodnumbers is <strong>NOT</strong> a medical device and <strong>DOES NOT</strong> give medical advice. It
              is <strong>NOT</strong> a substitute for professional healthcare advice, diagnosis, or treatment.
            </p>
            <p className="mb-4">
              <strong>
                Always consult a qualified healthcare professional (like your doctor) about your health and before
                changing your diabetes management based on anything from this Service.
              </strong>
              &nbsp;Do not disregard or delay seeking professional medical advice because of this Service.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Your Responsibility & Risk</h2>
            <p className="mb-4">You use Goodnumbers entirely at your own risk.</p>
            <p className="mb-4">You accept the risk that information from the Service may be inaccurate or wrong.</p>
            <p className="mb-4">
              You are solely responsible for how you interpret and use information from the Service and for your health
              decisions.
            </p>
            <p className="mb-4">
              The creators of Goodnumbers are not liable for any damages or harm resulting from your use (or inability
              to use) the Service or reliance on its information.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Acceptable Use</h2>
            <p className="mb-4">
              Please use Goodnumbers respectfully and appropriately. Do not try to harm the Service or input malicious
              data.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Intellectual Property</h2>
            <p className="mb-4">Goodnumbers and its software are our property.</p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Data Ownership</h2>
            <p className="mb-4">
              The data you enter is yours. We do not store any of the data you provide to the Service. Please see our{' '}
              <a href="/privacy-policy">Privacy Policy</a> for more information on data handling.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Service Availability and Termination</h2>
            <p className="mb-4">
              We aim to keep Goodnumbers running, but it might sometimes be unavailable, and we might eventually stop or
              suspend the Service.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Changes to Terms</h2>
            <p className="mb-4">
              We may update these Terms. Using the Service after changes means you accept the new Terms. Check the "Last
              Updated" date.
            </p>
          </div>
        </div>
      </WidgetWrapper>
    </>
  );
};

export default Page;
