import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  border?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  border = true,
}) => {
  const baseStyles = `
    bg-white dark:bg-gray-900
    ${border ? 'border border-gray-200 dark:border-gray-800' : ''}
    ${hover ? 'hover:shadow-xl transition-shadow duration-300' : ''}
  `;

  return (
    <div className={`rounded-xl ${baseStyles} ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`p-6 border-b border-gray-200 dark:border-gray-800 ${className}`}>
    {children}
  </div>
);

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`p-6 ${className}`}>{children}</div>;

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`p-6 border-t border-gray-200 dark:border-gray-800 ${className}`}>
    {children}
  </div>
);

export default Card;
