import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';

/**
 * Universal MarqueeText component.
 * Automatically measures rendered text vs container width.
 * If overflowing, smoothly and seamlessly rolls with start/end pauses and hover-pause.
 */
const MarqueeText = ({
  text = '',
  className = '',
  speed = 32, // pixels per second
  gap = 36,   // gap between repetitions in pixels
  pauseTime = 1.8, // pause at start in seconds
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [textWidth, setTextWidth] = useState(0);

  const checkOverflow = useCallback(() => {
    if (!containerRef.current || !textRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    // getBoundingClientRect().width gives the true pixel width when unconstrained
    const renderedWidth = textRef.current.getBoundingClientRect().width;

    if (renderedWidth > containerWidth + 2 && containerWidth > 0) {
      setIsOverflowing(true);
      setTextWidth(Math.ceil(renderedWidth));
    } else {
      setIsOverflowing(false);
      setTextWidth(0);
    }
  }, []);

  useLayoutEffect(() => {
    checkOverflow();
  }, [text, checkOverflow]);

  useEffect(() => {
    if (!containerRef.current) return;
    let ro = null;
    try {
      ro = new ResizeObserver(() => {
        checkOverflow();
      });
      ro.observe(containerRef.current);
    } catch (_) {}
    return () => ro && ro.disconnect();
  }, [checkOverflow]);

  if (!text) return null;

  // Calculate dynamic duration so speed is consistent regardless of text length
  const distance = textWidth + gap;
  const moveDuration = distance / speed;
  const totalDuration = Math.max(7, moveDuration + pauseTime * 2);

  return (
    <div
      ref={containerRef}
      className={`marquee-wrapper ${isOverflowing ? 'marquee-mask' : ''} ${className ? `${className}-wrap` : ''}`}
      title={text}
    >
      <div
        className={`marquee-track ${isOverflowing ? 'rolling' : 'static'}`}
        style={
          isOverflowing
            ? {
                animationDuration: `${totalDuration.toFixed(2)}s`,
              }
            : undefined
        }
      >
        <div className="marquee-segment">
          <span ref={textRef} className={`marquee-text-content ${className}`}>
            {text}
          </span>
          {isOverflowing && (
            <span
              className="marquee-gap"
              style={{ width: `${gap}px` }}
              aria-hidden="true"
            />
          )}
        </div>

        {isOverflowing && (
          <div className="marquee-segment" aria-hidden="true">
            <span className={`marquee-text-content ${className}`}>
              {text}
            </span>
            <span
              className="marquee-gap"
              style={{ width: `${gap}px` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MarqueeText;
