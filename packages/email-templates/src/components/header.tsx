import { Section, Text, Img, Row, Column } from "react-email";
import { sitehausColors } from "../theme";

export const Header = ({
  storeName = "OneHealth Store",
  email = "orders@notify.sitehaus.dev",
  logoUrl,
}: {
  storeName?: string;
  email?: string;
  logoUrl?: string;
}) => {
  return (
    <Section style={section}>
      <Row>
        <Column style={logoCol}>
          {logoUrl ? (
            <Img src={logoUrl} alt={storeName} height="32" style={logo} />
          ) : (
            <Text style={wordmark}>{storeName}</Text>
          )}
        </Column>
        <Column style={fromCol}>
          <Text style={fromLabel}>From</Text>
          <Text style={fromValue}>
            {storeName} <span style={fromEmail}>&lt;{email}&gt;</span>
          </Text>
        </Column>
      </Row>
    </Section>
  );
};

const section = {
  padding: "24px 40px 20px",
  backgroundColor: sitehausColors.parchment,
  borderBottom: `1px solid ${sitehausColors.line}`,
};

const logoCol = { verticalAlign: "middle" as const };

const fromCol = {
  verticalAlign: "middle" as const,
  textAlign: "right" as const,
};

const logo = { display: "block" };

const wordmark = {
  color: sitehausColors.ink,
  fontSize: "18px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  fontWeight: "700",
  margin: "0",
  lineHeight: "1",
};

const fromLabel = {
  color: sitehausColors.ink300,
  fontSize: "10px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0",
  lineHeight: "16px",
};

const fromValue = {
  color: sitehausColors.ink700,
  fontSize: "12px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  lineHeight: "18px",
  margin: "2px 0 0",
};

const fromEmail = {
  color: sitehausColors.ink300,
  fontSize: "11px",
};
