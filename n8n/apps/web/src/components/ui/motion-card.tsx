"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface MotionCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  delay?: number;
  hover?: boolean;
}

const variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0  },
};

export function MotionCard({ children, delay = 0, hover = true, className = "", ...rest }: MotionCardProps) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={hover ? { scale: 1.015, transition: { duration: 0.15 } } : undefined}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
