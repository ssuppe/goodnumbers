import React, { useState, useRef } from 'react';
import AudioPlayer from 'react-h5-audio-player';

const LazyAudioPlayer = ({ audioUrl }: { audioUrl: string }) => {
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false);
  const audioPlayerRef = useRef(null);

  const handlePlay = () => {
    if (!isPlayerLoaded) {
      setIsPlayerLoaded(true);
    }
  };

  return (
    <div className="w-full max-w-xl">
      {isPlayerLoaded ? (
        <AudioPlayer
          ref={audioPlayerRef}
          src={audioUrl}
          className="rounded-lg shadow-md"
          autoPlayAfterSrcChange={false}
        />
      ) : (
        <div
          className="bg-gray-100 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
          onClick={handlePlay}
        >
          <button className="flex items-center space-x-2 text-gray-700">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Click to load audio</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LazyAudioPlayer;
