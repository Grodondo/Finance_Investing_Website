import React from 'react';
import { motion } from 'framer-motion';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({ 
  children, 
  delay = 0, 
  duration = 0.5, 
  className = '' 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration, 
        delay,
        ease: [0.25, 0.1, 0.25, 1.0]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface SlideInProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
}

export const SlideIn: React.FC<SlideInProps> = ({ 
  children, 
  direction = 'left', 
  delay = 0, 
  duration = 0.5, 
  className = '' 
}) => {
  const directionMap = {
    left: { x: -40, y: 0 },
    right: { x: 40, y: 0 },
    up: { x: 0, y: -40 },
    down: { x: 0, y: 40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ 
        duration, 
        delay,
        ease: [0.25, 0.1, 0.25, 1.0]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface GlowButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlowButton: React.FC<GlowButtonProps> = ({ 
  children, 
  className = '', 
  onClick 
}) => {
  return (
    <motion.button
      className={`relative px-6 py-3 overflow-hidden rounded-md ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.span 
        className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-500 opacity-80 rounded-md"
        animate={{ 
          background: [
            'linear-gradient(90deg, rgb(79,70,229), rgb(147,51,234))',
            'linear-gradient(180deg, rgb(79,70,229), rgb(147,51,234))',
            'linear-gradient(270deg, rgb(79,70,229), rgb(147,51,234))',
            'linear-gradient(360deg, rgb(79,70,229), rgb(147,51,234))',
            'linear-gradient(90deg, rgb(79,70,229), rgb(147,51,234))'
          ] 
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <motion.span 
        className="absolute inset-0 opacity-0 bg-gradient-to-r from-indigo-400 to-purple-300 blur-xl rounded-md"
        whileHover={{ opacity: 0.6 }}
        transition={{ duration: 0.2 }}
      />
      <span className="relative z-10 font-semibold text-white">
        {children}
      </span>
    </motion.button>
  );
};

interface ParallaxProps {
  children: React.ReactNode;
  offset?: number;
  className?: string;
}

export const Parallax: React.FC<ParallaxProps> = ({ 
  children, 
  offset = 100, 
  className = '' 
}) => {
  return (
    <motion.div
      className={className}
      initial={{ y: offset }}
      animate={{ y: 0 }}
      transition={{
        type: "spring",
        stiffness: 10,
        damping: 20,
        restDelta: 0.001
      }}
    >
      {children}
    </motion.div>
  );
}; 