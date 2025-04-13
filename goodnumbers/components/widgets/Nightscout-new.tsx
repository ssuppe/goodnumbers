    );
  };

  const renderDebugViewer = () => {
    if (!debugMode) return null;

    const viewerData = assessmentData?.podcastResult;
    if (!viewerData) return null;

    return <DebugInterfaceViewer data={viewerData} />;
  };

  return (
    <WidgetWrapper id={id || ''} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}

      {/* Debug mode indicator */}
      {debugMode && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 mb-4 text-sm">
          Debug Mode Active
        </div>
      )}

      {storageError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading saved data: {storageError}
        </div>
      )}

      {formError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading form data: {formError}
        </div>
      )}

      {!formSubmitted && (
        <div className="flex items-stretch justify-center">
          <form onSubmit={handleSubmit} className="card h-fit max-w-2xl mx-auto p-5 md:p-12">
            {isLoading && (
              <div className="mb-4">
                <Progress value={progress} className="w-full" />
                <p className="text-center mt-2 text-gray-700 dark:text-slate-200">{progressText}</p>
              </div>
            )}
            {error && (
              <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            {/* Form fields - only shown when NOT loading */}
            {!isLoading && (
              <>
                {/* Nightscout URL input */}
                <input
                  type="text"
                  name="nightscout_url"
                  placeholder="Nightscout URL"
                  value={formData.nightscout_url}
                  onChange={handleInputChange}
                  className="w-full p-2 mb-4 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  name="nightscout_token"
                  placeholder="Nightscout Token"
                  value={formData.nightscout_token}
                  onChange={handleInputChange}
                  className="w-full p-2 mb-4 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <div className="w-full mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Preferred glucose units
                  </label>
                  <select
                    name="preferred_units"
                    value={formData.preferred_units}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  >
                    <option value="mg/dl">mg/dL</option>
                    <option value="mmol/L">mmol/L</option>
                  </select>
                </div>
                <label className="flex items-start mb-4 text-gray-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    name="terms_accepted"
                    checked={formData.terms_accepted}
                    onChange={handleInputChange}
                    className="mr-2 mt-1"
                  />
                  <span>
                    I understand this is experimental. The analysis might be wrong and does not constitute medical
                    advice. All data should be manually verified by you and your healthcare professionals.
                  </span>
                </label>
                <label className="flex items-start mb-4 text-gray-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    name="responsibility_accepted"
                    checked={formData.responsibility_accepted}
                    onChange={handleInputChange}
                    className="mr-2 mt-1"
                  />
                  <span>
                    I am consenting to sending this data, and understand I do not have to if I do not want to. I take
                    full responsibility for the sending of this data, as well as what I do with the information that is
                    given to me.
                  </span>
                </label>
                {/* Submit button - only shown when not loading */}
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className={`w-full p-2 text-white rounded ${
                    isFormValid
                      ? 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                      : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  }`}
                >
                  Create podcast
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {isClient && assessmentData && (
        <div className="mt-8 max-w-4xl mx-auto">
          <div className={`transition-opacity duration-600 ease-in-out ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            {!isLoading && (
              <>
                {assessmentData.timestamp && (
                  <div className="mb-4 text-gray-600 text-center">
                    Last results generated on {assessmentData.timestamp}
                  </div>
                )}
                {renderAssessmentContent()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Optional loading message */}
      {isClient && isLoading && (
        <div
          className={`mt-8 text-center text-gray-600 transition-opacity duration-600 ease-in-out ${
            isLoading ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Your results will appear here when we are done
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutComponent;