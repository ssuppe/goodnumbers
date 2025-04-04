import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

function SomeOtherComponent() {
  return (
    <div>
      <h2>Test Player</h2>
      <AudioPlayer src="test.mp3" /> {/* TS error here? */}
    </div>
  );
}
