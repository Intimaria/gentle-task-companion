'use client';

import React from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
      <h2 className="text-2xl font-bold text-red-700 mb-4">Something went wrong!</h2>
      <p className="mb-4 text-red-500">{error.message}</p>
      <button
        className="px-4 py-2 bg-red-200 text-red-800 rounded"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
