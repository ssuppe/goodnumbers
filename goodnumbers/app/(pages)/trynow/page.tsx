"use client";

import React, { useState, Suspense } from "react";
import "react-tabs/style/react-tabs.css";
import NightscoutForm from "~/components/widgets/Nightscout";

const Page = () => {
  const header = {
    title: "Your Nightscout Analysis"
  };

  return (
    <>
      <NightscoutForm
        header={header}
        id="nightscout-analysis"
        hasBackground={true}
      />
    </>
  );
};

export default Page;
