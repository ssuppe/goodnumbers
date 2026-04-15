export default function Banner() {
  return (
    <div className="v3-banner-title-bg py-2 px-2 text-sm font-medium sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-8 flex items-center gap-2 text-white">
        <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex-shrink-0 border border-white opacity-80">
          NOTE
        </span>
        <span className="text-left leading-snug">
          GoodNumbers is an experiment and is for educational use only. Do not
          make any changes to your diabetic healthcare plan without speaking to
          your doctor.
        </span>
      </div>
    </div>
  );
}
