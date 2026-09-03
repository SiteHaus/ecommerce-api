import { Hr, Link, Section, Text } from "react-email";
import { sitehausColors } from "../theme";

export const Footer = () => {
  return (
    <Section style={section}>
      <Hr style={hr} />
      <Text style={text}>
        Powered by{" "}
        <Link href="https://sitehaus.dev" style={link}>
          sitehaus.dev
        </Link>
      </Text>
      <Text style={copyright}>© {new Date().getFullYear()} Sitehaus. All rights reserved.</Text>
    </Section>
  );
};

const section = {
  textAlign: "center" as const,
  backgroundColor: sitehausColors.parchment,
  paddingBottom: "24px",
};
const hr = { borderColor: sitehausColors.line, margin: "20px 40px 16px" };
const text = {
  color: sitehausColors.ink700,
  fontSize: "12px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  lineHeight: "20px",
  margin: "0",
};
const link = { color: sitehausColors.terracotta, textDecoration: "none" };
const copyright = {
  color: sitehausColors.ink300,
  fontSize: "11px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  lineHeight: "18px",
  margin: "4px 0 0",
};
