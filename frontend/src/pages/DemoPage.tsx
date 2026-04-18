export default function DemoPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-8 py-8 text-center">
      <h1 className="text-3xl font-bold">GoodNumbers Demo</h1>
      <p className="mt-4 mb-8 text-gray-600">
        A quick walkthrough of the statistical analysis, glycemic hotspot
        detection, and AI-driven insights.
      </p>

      <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-black border border-gray-800">
        <video
          src="/videos/gn_demo.mp4"
          controls
          className="w-full aspect-video"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="mt-16 space-y-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold">Project Walkthrough</h2>

        <div className="space-y-4">
          <p className="text-lg text-gray-700 font-medium">
            1. Terms of Service & Privacy
          </p>
          <img
            src="/images/1tos.png"
            alt="Terms of Service"
            className="rounded-lg shadow-lg border border-gray-200 w-full"
          />
        </div>

        <div className="space-y-4">
          <p className="text-lg text-gray-700 font-medium">2. Account Setup</p>
          <img
            src="/images/2setup.png"
            alt="Account Setup"
            className="rounded-lg shadow-lg border border-gray-200 w-full"
          />
        </div>

        <div className="space-y-4">
          <p className="text-lg text-gray-700 font-medium">
            3. Dashboard & History
          </p>
          <img
            src="/images/3dashboard.png"
            alt="Dashboard"
            className="rounded-lg shadow-lg border border-gray-200 w-full"
          />
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100">
        <p className="text-sm text-gray-500 italic">
          Note: This is an experimental preview. Real journal entries are
          personalized to your Nightscout data.
        </p>
      </div>
    </div>
  );
}
