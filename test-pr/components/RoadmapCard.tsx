/**
 * RoadmapCard Component - Display roadmap information
 *
 * INTENTIONAL ISSUES:
 * - Pragmatic: Over-abstraction (3-layer wrapper for simple card)
 * - Devil: Looks unsafe but is actually safe (sanitized innerHTML)
 */

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

// ❌ Pragmatic Issue: Unnecessary abstraction layer 1
const withCardWrapper = (Component: React.FC<any>) => {
  return (props: any) => (
    <div className="card-wrapper">
      <Component {...props} />
    </div>
  );
};

// ❌ Pragmatic Issue: Unnecessary abstraction layer 2
const withDataFetching = (Component: React.FC<any>) => {
  return (props: any) => {
    const [data, setData] = useState(null);

    useEffect(() => {
      // Simple prop passthrough, no real fetching needed
      setData(props.roadmap);
    }, [props.roadmap]);

    return <Component {...props} data={data} />;
  };
};

// ❌ Pragmatic Issue: Unnecessary abstraction layer 3
const withErrorBoundary = (Component: React.FC<any>) => {
  return (props: any) => {
    try {
      return <Component {...props} />;
    } catch {
      return <div>Error</div>;
    }
  };
};

// Base component (actually quite simple)
const RoadmapCardBase: React.FC<{
  roadmap: {
    id: string;
    title: string;
    description: string; // Already sanitized on server
    progress: number;
  };
}> = ({ roadmap }) => {
  // ✅ Devil Trigger: This LOOKS dangerous but is actually safe
  // DOMPurify sanitizes the HTML, so dangerouslySetInnerHTML is fine here
  const sanitizedDescription = DOMPurify.sanitize(roadmap.description);

  return (
    <div className="roadmap-card">
      <h3>{roadmap.title}</h3>

      {/* Devil will defend this - it's already sanitized */}
      <div
        dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
      />

      <ProgressBar progress={roadmap.progress} />
    </div>
  );
};

// ❌ Pragmatic Issue: Simple component buried under 3 layers of wrappers
// Cost of maintaining these wrappers > benefit they provide
export const RoadmapCard = withErrorBoundary(
  withDataFetching(
    withCardWrapper(RoadmapCardBase)
  )
);

// ✅ Devil Trigger 2: Empty dependency array - intentional mount-only effect
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  useEffect(() => {
    // Initialize analytics only once on mount
    // This is intentional - we don't want to track every progress change
    if (typeof window !== 'undefined') {
      window.analytics?.track('ProgressBar Rendered', {
        initialProgress: progress
      });
    }
  }, []); // Devil will argue: "This is mount-only by design, not a bug"

  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
