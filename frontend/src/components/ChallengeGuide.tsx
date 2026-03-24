import { useEffect, useState } from "react";
import { Typography } from "antd";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

interface ChallengeGuideProps {
  challengeType: string;
  instruction: string;
}

const ICONS: Record<string, string> = {
  blink: "👁",
  turn_left: "👤",
  turn_right: "👤",
  nod: "👤",
};

export default function ChallengeGuide({ challengeType, instruction }: ChallengeGuideProps) {
  const { t } = useTranslation();
  const [animStep, setAnimStep] = useState(0);

  // Cycle animation steps
  useEffect(() => {
    const id = setInterval(() => setAnimStep((s) => (s + 1) % 2), 800);
    return () => clearInterval(id);
  }, []);

  const animationStyle = getAnimationStyle(challengeType, animStep);
  const icon = ICONS[challengeType] || "👤";

  return (
    <div style={{
      background: "linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)",
      border: "2px solid #1677ff",
      borderRadius: 16,
      padding: "20px 24px",
      marginBottom: 16,
      textAlign: "center",
    }}>
      {/* Animated icon */}
      <div style={{
        fontSize: 56,
        lineHeight: 1,
        marginBottom: 12,
        transition: "transform 0.4s ease-in-out",
        ...animationStyle,
      }}>
        {icon}
      </div>

      {/* Main instruction */}
      <Text style={{
        fontSize: 20,
        fontWeight: 700,
        color: "#1677ff",
        display: "block",
        marginBottom: 8,
      }}>
        {instruction}
      </Text>

      {/* Helper text */}
      <Text type="secondary" style={{ fontSize: 14 }}>
        {t(`attend.challengeHelp_${challengeType}`, { defaultValue: t("attend.challengeHint") })}
      </Text>
    </div>
  );
}

function getAnimationStyle(type: string, step: number): React.CSSProperties {
  switch (type) {
    case "blink":
      return {
        opacity: step === 0 ? 1 : 0.15,
        transform: step === 0 ? "scaleY(1)" : "scaleY(0.1)",
      };
    case "turn_left":
      return {
        transform: step === 0 ? "rotateY(0deg)" : "rotateY(40deg)",
      };
    case "turn_right":
      return {
        transform: step === 0 ? "rotateY(0deg)" : "rotateY(-40deg)",
      };
    case "nod":
      return {
        transform: step === 0 ? "rotateX(0deg)" : "rotateX(20deg) translateY(4px)",
      };
    default:
      return {};
  }
}
