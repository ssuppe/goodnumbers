// NightscoutWrapper.tsx
import React from 'react';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import NightscoutForm from './NightscoutForm';

interface NightscoutWrapperProps extends NightscoutProps {
  onAssessmentComplete?: (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  }) => void;
}

const NightscoutWrapper: React.FC<NightscoutWrapperProps> = ({ header, id, hasBackground = false, onAssessmentComplete }) => {
  return (
    <WidgetWrapper id={id || ''} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}
      <div className="flex items-stretch justify-center">
        <NightscoutForm onAssessmentComplete={onAssessmentComplete} />
      </div>
    </WidgetWrapper>
  );
};

export default NightscoutWrapper;