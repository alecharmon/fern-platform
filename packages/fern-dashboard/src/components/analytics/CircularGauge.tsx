interface CircularGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export default function CircularGauge({
  percentage,
  size = 100,
  strokeWidth = 20,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const strokeOffsetDeg = (strokeWidth / (2 * radius)) * (180 / Math.PI);
  const rotation = 90 + strokeOffsetDeg;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size}>
        <defs>
          <radialGradient id="circleGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#37C414" />
            <stop offset="50%" stopColor="#B4FFA180" />
            <stop offset="100%" stopColor="#37C414" />
          </radialGradient>
        </defs>
        <circle
          stroke="#65D6491A"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          style={{ border: "0.08px solid #70E155" }}
        />
        <circle
          stroke="url(#circleGradient)"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
          style={{ border: "0.08px solid #70E155" }}
        />
      </svg>
      <span className="text-radix-gray-9 absolute text-base font-semibold">
        {percentage}%
      </span>
    </div>
  );
}
