import { useEffect, useState } from "react";
import { Typography } from "antd";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

interface ChallengeGuideProps {
  challengeTypes: string[];
  instruction: string;
}

const ICONS: Record<string, string> = {
  turn_left: "FACE",
  turn_right: "FACE",
  nod: "FACE",
};

const LABELS: Record<string, string> = {
  turn_left: "Turn left",
  turn_right: "Turn right",
  nod: "Nod",
};

export default function ChallengeGuide({ challengeTypes, instruction }: ChallengeGuideProps) {
  const { t } = useTranslation();
  const [animStep, setAnimStep] = useState(0);
  const primaryChallenge = challengeTypes[0] || "nod";

  useEffect(() => {
    const id = setInterval(() => setAnimStep((s) => (s + 1) % 2), 800);
    return () => clearInterval(id);
  }, []);

  const animationStyle = getAnimationStyle(primaryChallenge, animStep);
  const icon = ICONS[primaryChallenge] || "FACE";

  return (
    <div style={{
      background: "linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)",
      border: "2px solid #1677ff",
      borderRadius: 16,
      padding: "20px 24px",
      marginBottom: 16,
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 28,
        lineHeight: 1,
        marginBottom: 12,
        transition: "transform 0.4s ease-in-out",
        fontWeight: 700,
        letterSpacing: 1,
        ...animationStyle,
      }}>
        {icon}
      </div>

      <Text style={{
        fontSize: 20,
        fontWeight: 700,
        color: "#1677ff",
        display: "block",
        marginBottom: 8,
      }}>
        {instruction}
      </Text>

      {challengeTypes.length > 1 && (
        <div style={{ marginBottom: 8 }}>
          {challengeTypes.map((type, index) => (
            <Text
              key={`${type}-${index}`}
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#1f1f1f",
              }}
            >
              {index + 1}. {LABELS[type] || type}
            </Text>
          ))}
        </div>
      )}

      <Text type="secondary" style={{ fontSize: 14 }}>
        {challengeTypes.length > 1
          ? t("attend.challengeHint")
          : t(`attend.challengeHelp_${primaryChallenge}`, { defaultValue: t("attend.challengeHint") })}
      </Text>
    </div>
  );
}

function getAnimationStyle(type: string, step: number): React.CSSProperties {
  switch (type) {
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
