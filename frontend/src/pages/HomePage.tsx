import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
      <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
        A smart weekly journal for type 1 diabetics
      </h1>
      <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
        <strong>GoodNumbers</strong> is an experimental weekly journal to help
        type 1 diabetics reflect and improve their blood sugar levels week to
        week. It uses a mix of good old statistical analysis to help you zero in
        on troublesome trends and identify patterns. It then leverages AI to help
        you reflect on strategies to address them. Use it for self-reflection, to
        find your blind spots in your diabetes management, and to continuously
        improve.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
        <Link
          to="/demo"
          className="inline-block px-8 py-3 rounded-lg text-base font-medium bg-white v3-primary-text border-2 v3-border-primary hover:bg-blue-50 transition-colors"
        >
          See a demo
        </Link>
        <a
          href="/api/auth/signin"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 rounded-lg text-base font-medium text-white v3-bg-primary border border-transparent v3-hover-bg-primary-hover hover:scale-[1.01] transition"
        >
          Login / Register
        </a>
      </div>
    </div>
  );
}