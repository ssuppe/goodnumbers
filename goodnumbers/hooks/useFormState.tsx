import { useState, useEffect, useCallback } from 'react';
import { GlucoseUnits } from '@/types/nightscout';
import {
  saveNightscoutUrl,
  saveNightscoutToken,
  savePreferredUnits,
  loadNightscoutUrl,
  loadNightscoutToken,
  loadPreferredUnits
} from '@/utils/assessmentStorage';

export interface FormData {
  nightscout_url: string;
  nightscout_token: string;
  preferred_units: GlucoseUnits;
  terms_accepted: boolean;
  responsibility_accepted: boolean;
}

export const useFormState = () => {
  // Default form state
  const [formData, setFormData] = useState<FormData>({
    nightscout_url: '',
    nightscout_token: '',
    preferred_units: 'mg/dl',
    terms_accepted: false,
    responsibility_accepted: false
  });

  const [error, setError] = useState<string | null>(null);

  // Load saved form data from localStorage on mount
  useEffect(() => {
    try {
      setFormData(prev => ({
        ...prev,
        nightscout_url: loadNightscoutUrl() || '',
        nightscout_token: loadNightscoutToken() || '',
        preferred_units: loadPreferredUnits() || 'mg/dl'
      }));
      setError(null);
    } catch (err) {
      console.error('Error loading form data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form data');
    }
  }, []);

  // Handle input changes (both text inputs and checkboxes)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const name = target.name as keyof FormData;
    
    if (target.type === 'checkbox') {
      const checkboxTarget = target as HTMLInputElement;
      
      setFormData(prev => ({
        ...prev,
        [name]: checkboxTarget.checked
      }));
    } else {
      const value = target.value;
      
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));

      // Save form field to localStorage
      try {
        if (name === 'nightscout_url') {
          saveNightscoutUrl(value);
        } else if (name === 'nightscout_token') {
          saveNightscoutToken(value);
        } else if (name === 'preferred_units') {
          savePreferredUnits(value as GlucoseUnits);
        }
      } catch (err) {
        console.error(`Error saving ${name}:`, err);
      }
    }
  }, []);

  // Update a form field programmatically
  const updateFormField = useCallback((field: keyof FormData, value: string | boolean | GlucoseUnits) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Save form field to localStorage (only for fields we want to persist)
    try {
      if (field === 'nightscout_url' && typeof value === 'string') {
        saveNightscoutUrl(value);
      } else if (field === 'nightscout_token' && typeof value === 'string') {
        saveNightscoutToken(value);
      } else if (field === 'preferred_units' && (value === 'mg/dl' || value === 'mmol/L')) {
        savePreferredUnits(value);
      }
    } catch (err) {
      console.error(`Error saving ${field}:`, err);
    }
  }, []);

  // Reset form state
  const resetForm = useCallback(() => {
    setFormData({
      nightscout_url: loadNightscoutUrl() || '',
      nightscout_token: loadNightscoutToken() || '',
      preferred_units: loadPreferredUnits() || 'mg/dl',
      terms_accepted: false,
      responsibility_accepted: false
    });
  }, []);

  return {
    formData,
    error,
    handleInputChange,
    updateFormField,
    resetForm
  };
};
