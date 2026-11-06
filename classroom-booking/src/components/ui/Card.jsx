import { forwardRef } from 'react';

const Card = forwardRef(({
  className = '',
  children,
  ...props
}, ref) => {
  const classes = `card ${className}`.trim();

  return (
    <div ref={ref} className={classes} {...props}>
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;