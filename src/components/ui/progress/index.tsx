import React from "react";
import * as RadixProgress from "@radix-ui/react-progress";
import "./styles.css";

interface ProgressProps {
  value: number;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({ value, className = "" }) => {
  return (
    <RadixProgress.Root className={`ProgressRoot ${className}`} value={value}>
      <RadixProgress.Indicator
        className="ProgressIndicator"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </RadixProgress.Root>
  );
};

export default Progress;