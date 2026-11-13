import React, { useEffect, useState } from 'react';
import {
  getCachedResolvedMediaUrl,
  isFirestoreMediaUrl,
  resolveMediaUrl,
} from '../services/firebase';

interface CloudImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  fallbackSrc?: string;
}

export const CloudImage: React.FC<CloudImageProps> = ({
  src,
  fallbackSrc,
  className = '',
  alt = '',
  onError,
  ...rest
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() =>
    getCachedResolvedMediaUrl(src)
  );
  const [isLoading, setIsLoading] = useState<boolean>(() =>
    Boolean(src && isFirestoreMediaUrl(src) && !getCachedResolvedMediaUrl(src))
  );

  useEffect(() => {
    let isMounted = true;

    if (!src) {
      setResolvedSrc(undefined);
      setIsLoading(false);
      return;
    }

    if (!isFirestoreMediaUrl(src)) {
      setResolvedSrc(src);
      setIsLoading(false);
      return;
    }

    const cached = getCachedResolvedMediaUrl(src);
    if (cached) {
      setResolvedSrc(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    resolveMediaUrl(src)
      .then((url) => {
        if (isMounted) {
          setResolvedSrc(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setResolvedSrc(fallbackSrc);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src, fallbackSrc]);

  if (isLoading || !resolvedSrc) {
    return (
      <div
        className={`bg-neutral-100 animate-pulse ${className}`}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={(e) => {
        if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
          e.currentTarget.src = fallbackSrc;
        }
        onError?.(e);
      }}
      {...rest}
    />
  );
};
