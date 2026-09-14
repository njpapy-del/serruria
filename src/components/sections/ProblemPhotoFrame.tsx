"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

const ROTATE_MS = 3200;

export function ProblemPhotoFrame({
  photos,
  alt,
  fallback,
}: {
  photos: string[];
  alt: string;
  fallback: ReactNode;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [photos.length]);

  if (photos.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={photos[index]}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0"
      >
        <Image
          src={photos[index]}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 22vw, 45vw"
          className="object-cover"
        />
      </motion.div>
    </AnimatePresence>
  );
}
